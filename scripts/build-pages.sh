#!/usr/bin/env bash
# Builds the online demo for GitHub Pages: the quiz as plain static files, with no server.
#
# Usage: scripts/build-pages.sh [output-dir]
#   output-dir  default pages-out/ at the repo root, which git ignores
#
# Environment:
#   QUIZ_BASE_PATH  where the site is served from, default /star-exam-companion
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

# Only an output folder this script made, or an empty one, may be replaced.
if [ -e "$OUT" ] && [ ! -f "$OUT/.nojekyll" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
  echo "build-pages: $OUT exists and was not made by this script; choose another folder or remove it" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

rsync -a --exclude node_modules --exclude '.next*' --exclude 'scores*' --exclude '.env*' "$ROOT/quiz/" "$work/quiz/"
cp -R "$ROOT/exams" "$work/exams"

# The demo's pages replace the three that need the local server; what needs a server goes.
cp -R "$ROOT/pages-static/." "$work/quiz/"
rm -rf "$work/quiz/app/api" "$work/quiz/app/sw.js" "$work/quiz/app/read/[course]" "$work/quiz/app/read/night" "$work/quiz/app/read/loading.tsx"

pnpm --dir "$work/quiz" install --frozen-lockfile --silent
(
  cd "$work/quiz"
  QUIZ_STATIC=1 NEXT_PUBLIC_QUIZ_STATIC=1 QUIZ_BASE_PATH="$BASE" QUIZ_DIST_DIR=out NEXT_TELEMETRY_DISABLED=1 \
    QUIZ_COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
    pnpm build
)

[ -f "$work/quiz/out/index.html" ] || { echo "build-pages: the export has no index.html" >&2; exit 1; }
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$work/quiz/out/." "$OUT/"
# Tells GitHub Pages to serve the files as they are, and marks this folder as ours to replace.
touch "$OUT/.nojekyll"

echo "built: $OUT (served from ${BASE:-/})"
