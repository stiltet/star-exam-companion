<div align="center">

<img src="quiz/public/favicon.png" width="112" alt="Star Exam Companion icon" />

# Star Exam Companion

**An open-source, voice-first study app for the Google Cloud Generative AI Leader exam.**

[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Node.js 22.18+](https://img.shields.io/badge/node-%E2%89%A522.18-339933.svg)](https://nodejs.org)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000.svg)](https://nextjs.org)
[![Issues](https://img.shields.io/github/issues/stiltet/star-exam-companion.svg)](https://github.com/stiltet/star-exam-companion/issues)

</div>

> [!IMPORTANT]
> **Not an official Google product.** Star Exam Companion is independent and is not affiliated with,
> sponsored or endorsed by Google. The Google Cloud name and logo and the other Google product names
> are trademarks of Google LLC. Always check the content against Google's official documentation.

## Contents

- [Why Star Exam Companion](#why-star-exam-companion)
- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Use it on a phone, offline](#use-it-on-a-phone-offline)
- [Data and privacy](#data-and-privacy)
- [Project structure](#project-structure)
- [Development](#development)
- [Contributing and support](#contributing-and-support)
- [Credits](#credits)
- [Licence and trademarks](#licence-and-trademarks)

## Why Star Exam Companion

It was built to pass the Google Cloud Generative AI Leader exam, and it did. It turns the exam
guide into spoken scenes you answer out loud or with a tap, keeps asking what you have not learned
yet, and explains every wrong answer with the constraint that decides it. It runs on your own
machine, keeps your answers there, and works on a phone without a connection once installed.

## Features

| Feature | What it does | Requires |
|---|---|---|
| **Voice Quiz** | Reads each exam-style scene and its four options aloud, explains a wrong answer and its binding constraint, and keeps asking until each term is learned. | The local server, on macOS |
| **Read Aloud** | Reads Google's learning-path course text aloud, sentence by sentence, with a night-reading mode. | The local server, on macOS |
| **Practice** | Exam-style questions by section or topic, with explanations and an "unanswered only" filter. | The local server, to save answers |
| **Practice exam** | A timed exam that mirrors the real one, with a full review afterwards. | The local server, to save answers |
| **Flashcards and Glossary** | Every exam term, using the exam guide's own name first, each meaning with its source. | Nothing extra |
| **Progress** | Results per mode and per section, from every device that studies against your machine. | The local server |
| **Offline** | The installed app opens every page with no connection; answers wait on the device and sync later. | The production build; HTTPS on other devices ([how](#use-it-on-a-phone-offline)) |

## How it works

- A **Next.js** app in `quiz/` renders every page and serves a few local API routes.
- Questions are built from [`glossary.md`](glossary.md) and the section weights in
  [`exam-sections.md`](exam-sections.md); both are read at run time.
- Answers are saved **on the device first** and then sent to the server, which appends them to
  `quiz/scores.jsonl` on your machine. Your answers are sent nowhere else.
- Speech comes from the **macOS text-to-speech voice** (`say`), rendered on your machine and cached.
- A **service worker** stores the pages, so the installed app works offline.

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22.18 or newer | The first release that runs TypeScript without a flag; the tests need it. |
| pnpm | 10.6 or newer | Applies the dependency security pins in `quiz/pnpm-workspace.yaml`. |
| macOS | any current | Only for Voice Quiz and Read Aloud audio; everything else runs on Linux and Windows. |

## Quick start

Run the commands from a POSIX shell: Terminal on macOS and Linux, Git Bash or WSL on Windows.

```bash
git clone https://github.com/stiltet/star-exam-companion.git
```

```bash
cd star-exam-companion
```

```bash
pnpm --dir quiz install
```

```bash
pnpm --dir quiz build
```

```bash
NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next start -H 127.0.0.1
```

Open **http://localhost:3000/**. This production build also works offline once installed.

For development, this server reloads as you change code but has no offline mode:

```bash
NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next dev -H 127.0.0.1
```

`-H 127.0.0.1` keeps the quiz on your machine; the package's own `dev` and `start` scripts listen
on every network interface.

## Configuration

All settings are optional environment variables. Put them in `quiz/.env.local` (git ignores it) or
in the shell that starts the quiz.

| Variable | Default | Purpose |
|---|---|---|
| `QUIZ_LAN_HOST` | unset | The one address or name, without a port, that other devices open. Unset, only pages opened on this machine (`localhost`, `127.0.0.1`, `[::1]`) can save answers. |
| `QUIZ_SCORES_FILE` | `quiz/scores.jsonl` | Where answers are saved. |
| `NIGHT_DIR` | `~/Library/Caches/star-exam-night` | Where night-reading audio is cached. An absolute path starting with `/`; any other value is ignored and the default is used. |
| `QUIZ_DIST_DIR` | `.next` | The build folder, so a second build does not replace a running one. |

## Use it on a phone, offline

A phone needs HTTPS for offline mode. [`docs/https.md`](docs/https.md) walks through every step:
make a home certificate with `scripts/make-cert.sh`, serve the quiz through nginx, and trust the
certificate on **iOS, Android, macOS, Windows and Linux**. Then set `QUIZ_LAN_HOST` to your
machine's address on your network. The examples use `127.0.0.1` as a stand-in for that address.

## Data and privacy

- **Your answers stay on your machine**, in `quiz/scores.jsonl` and in the browser of each device
  you study on. Git ignores the scores file and its backups.
- **No accounts, analytics or tracking.** The app's own scripts and the start and dev commands
  here switch Next.js telemetry off.
- **Deleting your data:** **Reset progress** on the Progress page empties `quiz/scores.jsonl`
  after copying it to `quiz/scores-backups/`. To erase everything, delete `quiz/scores.jsonl` and
  `quiz/scores-backups/`, then clear this site's data in each browser you studied in.
- **Read Aloud** fetches Google's course text live from Google's servers; whoever runs the quiz is
  responsible for following Google's terms for it. See [`NOTICE`](NOTICE).

## Project structure

```text
.
├── quiz/                 The Next.js app: pages, components, API routes and tests
├── glossary.md           Every exam term, one row each, with its source
├── exam-sections.md      The four exam sections and their weights
├── checks/               The exam guide's term list, used by the tests
├── docs/https.md         HTTPS, certificates and offline mode on every platform
├── scripts/make-cert.sh  Makes the home HTTPS certificate
├── LICENSE               MIT, for this repository's own files
└── NOTICE                Third-party code, dependencies, trademarks and Google's material
```

## Development

```bash
node --test
```

```bash
pnpm --dir quiz build
```

Run both from the repository root, after the install step in [Quick start](#quick-start).
`node --test` runs every unit test; `pnpm --dir quiz build` also type-checks the app. Both must
pass before a change is proposed.

## Contributing and support

- **Bugs and ideas:** open a [GitHub issue](https://github.com/stiltet/star-exam-companion/issues).
- **Changes:** fork the repository, keep each pull request to one change, and include tests.
- **Content corrections:** every glossary row names its source; point to the official page that
  shows the correct wording.
- **Security problems:** please do not open a public issue. Report them privately with GitHub's
  private vulnerability reporting: **Security** tab, then **Report a vulnerability**.

## Credits

- **[gail-exam-preparation](https://github.com/ludovicobesana/gail-exam-preparation)** by
  [Ludovico Besana](https://www.ludovicobesana.com/), MIT. Star Exam Companion is built on it.
- **[shadcn/ui](https://github.com/shadcn-ui/ui)** by shadcn, MIT, for the UI components in
  `quiz/components/ui/`.
- **Open-source libraries:** [Next.js](https://nextjs.org), [React](https://react.dev),
  [Radix UI](https://www.radix-ui.com), [Tailwind CSS](https://tailwindcss.com),
  [Lucide](https://lucide.dev) and the other packages in `quiz/package.json`, each under its own
  licence.
- **Google's** exam guide, study guide and documentation, cited row by row in the glossary.

## Licence and trademarks

This repository's own files are released under the [MIT licence](LICENSE). The parts of `quiz/` that
come from gail-exam-preparation keep their MIT notice in [`quiz/LICENSE`](quiz/LICENSE).
[`NOTICE`](NOTICE) lists everything the licence does not cover: third-party code, dependencies,
Google's trademarks and logo, Google's text, and the system voice.
