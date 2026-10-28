# Star Exam Companion

<img src="quiz/public/favicon.png" width="120" alt="" />

A free study app for the Google Cloud **Generative AI Leader** exam: a spoken voice quiz, practice
questions, timed exams, flashcards, a glossary, read-aloud course text and progress tracking.

Built on [gail-exam-preparation](https://github.com/ludovicobesana/gail-exam-preparation) by
Ludovico Besana (MIT).

> **Not an official Google product.** Not affiliated with, sponsored or endorsed by Google. Google
> Cloud and the other Google product names are trademarks of Google LLC. Always check the content
> against Google's official documentation.

## Run it

Needs Node.js 22.18 or newer and [pnpm](https://pnpm.io). The spoken voice uses macOS's `say`, so
voice features need a Mac; everything else runs anywhere.

```bash
pnpm --dir quiz install
```

```bash
pnpm --dir quiz build
```

```bash
NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next start -H 127.0.0.1
```

Open http://localhost:3000/. This production build also works offline once installed. For quick
edits, `pnpm --dir quiz exec next dev -H 127.0.0.1` reloads as you change code, but has no offline
mode. `-H 127.0.0.1` keeps the quiz on your machine; the package's own `dev` and `start` scripts
listen on every network interface.

Your answers are saved to `quiz/scores.jsonl`, which git ignores.

## Use it on a phone

A phone needs HTTPS for offline mode. [`docs/https.md`](docs/https.md) shows how to make a home
certificate with `scripts/make-cert.sh`, serve the quiz through nginx, and trust the certificate
on iOS, Android, macOS, Windows and Linux.

Unset, `QUIZ_LAN_HOST` lets only pages opened at `localhost` save answers. For a phone, set it to
the one address or name the phone opens, without a port, in `quiz/.env.local` or the environment.
The examples use `127.0.0.1` as a stand-in; replace it with your machine's address on your network.

## Content

| File | What it holds |
|---|---|
| [`glossary.md`](glossary.md) | Every exam term, one row each, with its source. The questions are built from it. |
| [`exam-sections.md`](exam-sections.md) | The four exam sections and their weights. |

Read Aloud fetches Google's course text live from Google; whoever runs the quiz is responsible for
following Google's terms. See [`NOTICE`](NOTICE).

## Test

```bash
node --test
```

```bash
pnpm --dir quiz build
```

## Issues

Report a problem or suggest a change in
[GitHub issues](https://github.com/stiltet/star-exam-companion/issues).

## Licence

MIT for this repository's own files ([`LICENSE`](LICENSE)). `quiz/` keeps its upstream MIT notice
in [`quiz/LICENSE`](quiz/LICENSE). [`NOTICE`](NOTICE) lists what the licence does not cover:
Google's trademarks and text.
