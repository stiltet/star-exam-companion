#!/usr/bin/env bash
# Builds the online demo for GitHub Pages: the quiz as plain static files, with no server.
#
# Usage: scripts/build-pages.sh [output-dir]
#   output-dir  default pages-out/ at the repo root, which git ignores
#
# Environment:
#   QUIZ_BASE_PATH  where the site is served from, default /star-exam-companion
#
# One demo is built for every exam pack under exams/. The default exam (generative-ai-leader) is at the
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

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

rsync -a --exclude node_modules --exclude '.next*' --exclude 'scores*' --exclude 'active-exam.json' --exclude '.env*' "$ROOT/quiz/" "$work/quiz/"
cp -R "$ROOT/exams" "$work/exams"

# The demo's pages replace the three that need the local server; what needs a server goes.
cp -R "$ROOT/pages-static/." "$work/quiz/"
rm -rf "$work/quiz/app/api" "$work/quiz/app/sw.js" "$work/quiz/app/read/[course]" "$work/quiz/app/read/capture" "$work/quiz/app/read/night" "$work/quiz/app/read/loading.tsx"

pnpm --dir "$work/quiz" install --frozen-lockfile --silent

# The default exam: quiz/lib/pack.ts DEFAULT_EXAM. The packs, as "id=Title" pairs for the demo's links.
DEFAULT_EXAM="generative-ai-leader"
packs=""
for dir in "$ROOT"/exams/*/; do
  id="$(basename "$dir")"
  [ -f "$dir/pack.json" ] || continue
  title="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).title)' "$dir/pack.json")"
  packs="${packs:+$packs;}$id=$title"
done
[ -n "$packs" ] || { echo "build-pages: no exam pack under $ROOT/exams" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"
for dir in "$ROOT"/exams/*/; do
  id="$(basename "$dir")"
  [ -f "$dir/pack.json" ] || continue
  if [ "$id" = "$DEFAULT_EXAM" ]; then base="$BASE"; dest="$OUT"; else base="$BASE/$id"; dest="$OUT/$id"; fi
  (
    cd "$work/quiz"
    QUIZ_EXAM="$id" QUIZ_STATIC=1 NEXT_PUBLIC_QUIZ_STATIC=1 QUIZ_BASE_PATH="$base" QUIZ_DIST_DIR="out-$id" \
      NEXT_PUBLIC_DEMO_ROOT="$BASE" NEXT_PUBLIC_DEMO_CURRENT="$id" NEXT_PUBLIC_DEMO_DEFAULT="$DEFAULT_EXAM" NEXT_PUBLIC_DEMO_PACKS="$packs" NEXT_TELEMETRY_DISABLED=1 \
      QUIZ_COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
      pnpm build
  )
  [ -f "$work/quiz/out-$id/index.html" ] || { echo "build-pages: the export for $id has no index.html" >&2; exit 1; }
  mkdir -p "$dest"
  cp -R "$work/quiz/out-$id/." "$dest/"
done
# Tells GitHub Pages to serve the files as they are, and marks this folder as ours to replace.
touch "$OUT/.nojekyll"

echo "built: $OUT (served from ${BASE:-/})"
