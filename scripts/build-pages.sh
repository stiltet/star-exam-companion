#!/usr/bin/env bash
# Builds the online demo for GitHub Pages: the quiz as plain static files, with no server.
#
# Usage: scripts/build-pages.sh [output-dir]
#   output-dir  default pages-out/ at the repo root, which git ignores
#
# Environment:
#   QUIZ_BASE_PATH  where the site is served from, default /star-exam-companion
#
# One demo is built for every exam under exams/. The default exam (generative-ai-leader) is at the
# root of the site, and every other pack at <root>/<pack id>/. The demo's Progress page links them all.
#
# It never changes quiz/. It copies the repo's content to a temporary folder, puts the demo's own
# files (pages-static/, laid out like quiz/) over it, removes what needs a server (the API routes,
# the service worker and the course readings), and builds the export there. Voice Quiz, Read Aloud
# and Progress become a panel saying they run on the reader's own computer; Practice filters in the
# browser; Study, the Practice exam, Flashcards, the Glossary and About work as they do locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/pages-out}"
BASE="${QUIZ_BASE_PATH-/star-exam-companion}"

command -v pnpm >/dev/null 2>&1 || { echo "build-pages: pnpm not found" >&2; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "build-pages: rsync not found" >&2; exit 1; }
[ -d "$ROOT/pages-static/app" ] || { echo "build-pages: $ROOT/pages-static/app is missing" >&2; exit 1; }
case "$BASE" in "" | /*) ;; *) echo "build-pages: QUIZ_BASE_PATH must be empty or start with /: $BASE" >&2; exit 1 ;; esac

# Check every pack and keep the private reading store outside the static build's source tree.
QUIZ_ROOT="$ROOT" node "$ROOT/quiz/lib/check-static-packs.ts" "$ROOT"

# Only an output folder this script made, or an empty one, may be replaced.
if [ -e "$OUT" ] && [ ! -f "$OUT/.nojekyll" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
  echo "build-pages: $OUT exists and was not made by this script; choose another folder or remove it" >&2
  exit 1
fi

# The build folder sits inside the repository (git ignores it). Next takes the folder that holds pnpm-lock.yaml as its root,
# and with no lockfile in the build folder that is the repository, which holds the installed dependencies linked in below;
# Next refuses to compile through a link that leaves its root.
mkdir -p "$ROOT/.pages-work"
work="$(mktemp -d "$ROOT/.pages-work/build.XXXXXX")"
# The builds below run in the background, each in a process group of its own (set -m). An interrupt, a hang-up, a TERM or an
# error stops them, and waits for them to end, before their folder is removed. A KILL of the script cannot be caught.
set -m
ids=()
pids=()
cleanup() {
  for pid in ${pids[@]+"${pids[@]}"}; do kill -TERM -- "-$pid" 2>/dev/null || true; done
  for pid in ${pids[@]+"${pids[@]}"}; do wait "$pid" 2>/dev/null || true; done
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 129' HUP
trap 'exit 143' TERM

rsync -a --exclude node_modules --exclude '.next*' --exclude 'scores*' --exclude 'active-exam.json' --exclude '.env*' "$ROOT/quiz/" "$work/quiz/"
cp -R "$ROOT/exams" "$work/exams"

# The demo's pages replace the three that need the local server; what needs a server goes.
cp -R "$ROOT/pages-static/." "$work/quiz/"
rm -rf "$work/quiz/app/api" "$work/quiz/app/sw.js" "$work/quiz/app/read/[course]" "$work/quiz/app/read/night" "$work/quiz/app/read/loading.tsx"

# Dependencies: the ones this checkout has installed are linked in (same lockfile, no second install), and the repository's
# own package files stay the root. Where they are not installed, the copy gets its own package files and installs from the
# lockfile. Next runs directly, as quiz's `build` script does: `pnpm build` would reinstall a linked node_modules.
if [ -d "$ROOT/node_modules" ] && [ -d "$ROOT/quiz/node_modules" ]; then
  ln -s "$ROOT/node_modules" "$work/node_modules"
  ln -s "$ROOT/quiz/node_modules" "$work/quiz/node_modules"
else
  cp "$ROOT/package.json" "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml" "$work/"
  pnpm --dir "$work" install --frozen-lockfile --silent
fi

# The default exam: quiz/lib/pack.ts DEFAULT_EXAM. The packs, as "id=Title" pairs for the demo's links.
DEFAULT_EXAM="generative-ai-leader"
packs=""
for dir in "$ROOT"/exams/*/; do
  id="$(basename "$dir")"
  [ -f "$dir/pack.json" ] || continue
  title="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).title)' "$dir/pack.json")"
  packs="${packs:+$packs;}$id=$title"
done
[ -n "$packs" ] || { echo "build-pages: no exam under $ROOT/exams" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"
# Every pack is built at the same time, each in its own copy of quiz/ (Next writes next-env.d.ts and the
# TypeScript cache next to the source, so two builds in one folder would race). The copies hold links into
# the shared node_modules, which stay valid because the copies sit beside quiz/ in the same temporary folder.
# Each build's output goes to its own log, which is printed in pack order when it is done.
for dir in "$ROOT"/exams/*/; do
  id="$(basename "$dir")"
  [ -f "$dir/pack.json" ] || continue
  if [ "$id" = "$DEFAULT_EXAM" ]; then base="$BASE"; else base="$BASE/$id"; fi
  cp -R "$work/quiz" "$work/quiz-$id"
  (
    cd "$work/quiz-$id"
    QUIZ_EXAM="$id" QUIZ_STATIC=1 NEXT_PUBLIC_QUIZ_STATIC=1 QUIZ_BASE_PATH="$base" QUIZ_DIST_DIR="out-$id" \
      NEXT_PUBLIC_DEMO_ROOT="$BASE" NEXT_PUBLIC_DEMO_CURRENT="$id" NEXT_PUBLIC_DEMO_DEFAULT="$DEFAULT_EXAM" NEXT_PUBLIC_DEMO_PACKS="$packs" NEXT_TELEMETRY_DISABLED=1 \
      QUIZ_COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
      ./node_modules/.bin/next build
  ) > "$work/build-$id.log" 2>&1 < /dev/null &
  ids+=("$id")
  pids+=("$!")
done
failed=""
for index in "${!ids[@]}"; do
  id="${ids[$index]}"
  if wait "${pids[$index]}"; then :; else failed="$failed $id"; fi
  echo "== build of $id"
  cat "$work/build-$id.log"
done
[ -z "$failed" ] || { echo "build-pages: the build failed for:$failed" >&2; exit 1; }
for id in "${ids[@]}"; do
  [ -f "$work/quiz-$id/out-$id/index.html" ] || { echo "build-pages: the export for $id has no index.html" >&2; exit 1; }
  if [ "$id" = "$DEFAULT_EXAM" ]; then dest="$OUT"; else dest="$OUT/$id"; fi
  mkdir -p "$dest"
  cp -R "$work/quiz-$id/out-$id/." "$dest/"
done
# Tells GitHub Pages to serve the files as they are, and marks this folder as ours to replace.
touch "$OUT/.nojekyll"

echo "built: $OUT (served from ${BASE:-/})"
