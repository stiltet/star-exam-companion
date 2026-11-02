<div align="center">

<img src="quiz/public/favicon.png" width="112" alt="Star Exam Companion icon" />

# Star Exam Companion

**An open-source, voice-first study app for Google Cloud certification exams, one exam pack per exam.**

[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Node.js 22.18+](https://img.shields.io/badge/node-%E2%89%A522.18-339933.svg)](https://nodejs.org)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000.svg)](https://nextjs.org)
[![Issues](https://img.shields.io/github/issues/stiltet/star-exam-companion.svg)](https://github.com/stiltet/star-exam-companion/issues)

**[▶ Watch the product demo](https://youtu.be/R-RCiKXjGpc)** (video, YouTube)

<a href="https://youtu.be/R-RCiKXjGpc"><img src="https://i.ytimg.com/vi/R-RCiKXjGpc/hqdefault.jpg" width="480" alt="Watch the Star Exam Companion product demo on YouTube" /></a>

</div>

> [!IMPORTANT]
> **Not an official Google product.** Star Exam Companion is independent and is not affiliated with,
> sponsored or endorsed by Google. The Google Cloud name and logo and the other Google product names
> are trademarks of Google LLC. Always check the content against Google's official documentation.

**[Try the online demo](https://stiltet.github.io/star-exam-companion/)**: Study, Practice, the
Practice exam, Flashcards and the Glossary run in your browser. Voice Quiz, Read Aloud and Progress
are core features that need the quiz on your own computer; the [full local setup](#full-local-setup)
below gets everything working.

## Contents

- [Why Star Exam Companion](#why-star-exam-companion)
- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Choose your exam](#choose-your-exam)
- [Configuration](#configuration)
- [Full local setup](#full-local-setup)
- [Data and privacy](#data-and-privacy)
- [Project structure](#project-structure)
- [Development](#development)
- [Contributing and support](#contributing-and-support)
- [Credits](#credits)
- [Licence and trademarks](#licence-and-trademarks)

## Why Star Exam Companion

It was built to pass the Google Cloud Generative AI Leader exam, and it did. Stellan Lindell passed the exam on first try. It now serves
any exam that has a pack, starting with that one and Professional Agentic Architect. It turns an exam
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
| **Offline** | The installed app opens every page with no connection; answers wait on the device and sync later. | The production build; HTTPS on other devices ([how](#full-local-setup)) |
| **Install tip** | On a phone or tablet, a small card offers to add the quiz to the home screen: an Install button on Android (or the browser-menu steps when the browser offers no prompt), the Share steps on iOS Safari. Desktop, in-app browsers and the installed app see nothing; non-Safari iOS browsers are told to open the page in Safari. The exam and Voice Quiz also suppress it. *Not now* hides it for 30 days. The online demo shows it too. | Nothing extra |

## How it works

- A **Next.js** app in `quiz/` renders every page and serves a few local API routes.
- Everything about one exam lives in an **exam pack**, the folder `exams/<id>/`. Questions are
  built from the pack's glossary, scenes and section weights, read at run time. One install serves
  one exam: set `QUIZ_EXAM` to its pack name. Adding an exam is adding a folder; see
  [`docs/exam-packs.md`](docs/exam-packs.md).
- Answers are saved **on the device first** and then sent to the server, which appends them to
  `quiz/scores-<exam>.jsonl` on your machine. Your answers are sent nowhere else.
- Speech comes from the **macOS text-to-speech voice** (`say`), rendered on your machine and cached.
- A **service worker** stores the pages, so the installed app works offline.

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22.18 or newer | The first release that runs TypeScript without a flag; the tests need it. `.nvmrc` pins 24.22.2, the version CI runs, so with nvm run `nvm install` then `nvm use` in the repository. |
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

## Choose your exam

One install studies one exam. The exam is an **exam pack**, a folder under [`exams/`](exams/), and
you pick it with `QUIZ_EXAM` when you build and start the quiz. Without it you get the default,
`generative-ai-leader`.

| Pack (`QUIZ_EXAM`) | Exam |
|---|---|
| `generative-ai-leader` (default) | Google Cloud Generative AI Leader |
| `agentic-architect` | Google Cloud Professional Agentic Architect. **In progress:** the first batch of terms and scenes, with all five exam sections in Study. Read Aloud is not available for it. |

To see which packs your copy has:

```bash
ls exams
```

To switch exams while the quiz runs, open **Progress**, scroll to the bottom, pick the exam under
**Switch exam** and confirm. Every device on that computer follows the choice, and each exam keeps
its own scores. The choice is saved in `quiz/active-exam.json`, which git ignores.

`QUIZ_EXAM` sets the exam a fresh install starts with, before anything is chosen. Set it for the
build and for the start. Replace `PACK` with a name from the list:

```bash
QUIZ_EXAM=PACK pnpm --dir quiz build
```

```bash
QUIZ_EXAM=PACK NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next start -H 127.0.0.1
```

For development, `QUIZ_EXAM=PACK NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next dev -H 127.0.0.1`
serves the same pack. If you run the quiz as a login service ([full local setup](#full-local-setup)),
put `QUIZ_EXAM=PACK` in `quiz/.env.local`, then build and restart. Your answers stay separate for
each exam, so switching never mixes them.

Missing your exam? A pack is a folder of data, with no code to change: see
[`docs/exam-packs.md`](docs/exam-packs.md) and [Contributing and support](#contributing-and-support).

## Configuration

All settings are optional environment variables. Put them in `quiz/.env.local` (git ignores it) or
in the shell that starts the quiz.

| Variable | Default | Purpose |
|---|---|---|
| `QUIZ_LAN_HOST` | unset | The one address or name, without a port, that other devices open. Unset, only pages opened on this machine (`localhost`, `127.0.0.1`, `[::1]`) can save answers. |
| `QUIZ_EXAM` | `generative-ai-leader` | The exam pack to serve: a folder name under `exams/`. Only the starting exam: once you switch on the Progress page, that choice wins. |
| `QUIZ_EXAM_SETTING_FILE` | `quiz/active-exam.json` | Where the exam chosen on the Progress page is saved. |
| `QUIZ_SCORES_FILE` | `quiz/scores-<exam>.jsonl` | Where answers are saved. The default name carries the exam, such as `scores-generative-ai-leader.jsonl`. |
| `NIGHT_DIR` | `~/Library/Caches/star-exam-night` | Where night-reading audio is cached. An absolute path starting with `/`; any other value is ignored and the default is used. |
| `QUIZ_DIST_DIR` | `.next` | The build folder, so a second build does not replace a running one. |

## Full local setup

This sets the quiz up the way its author runs it, with every feature working: at `http://localhost/`,
and over HTTPS on your phone, offline, with the voice. It takes about 20 minutes.

**You need** everything under [Requirements](#requirements), plus [nginx](https://nginx.org) and
`openssl`. The voice needs a Mac. `ADDRESS` below is your machine's address on your home
network, the one the command in step 2 prints; give it a fixed address in your router so the
certificate keeps matching.

**1. Clone, install and build.** Run the clone, install and build commands of
[Quick start](#quick-start), but not its start command.

**2. Tell the quiz your address.** Find it with `ipconfig getifaddr en0` (macOS), `hostname -I`
(Linux) or `ipconfig` (Windows). If that prints nothing, look under System Settings > Network; if it
prints several, use the one on your home network, usually starting with 192.168 or 10. Then, with
`ADDRESS` replaced, add it to `quiz/.env.local` (the `>>` keeps any settings already there):

```bash
echo "QUIZ_LAN_HOST=ADDRESS" >> quiz/.env.local
```

**3. Make the certificate** that lets your phone use HTTPS. It is yours alone: the root key that
could sign other certificates is deleted as soon as it is made. Keep `certs/quiz.key` private, and
never commit or share it; it is the one secret.

```bash
bash scripts/make-cert.sh certs ADDRESS
```

**4. Keep the quiz running** on port 47830, and start it again at login. Build first (step 1): the
service starts the built app.

On **macOS**, run this from the repository folder, then load it:

```bash
REPO="$(pwd)"
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.star-exam-companion.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.star-exam-companion</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$REPO" &amp;&amp; NEXT_TELEMETRY_DISABLED=1 exec pnpm --dir quiz exec next start -H 127.0.0.1 -p 47830</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/star-exam-companion.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/star-exam-companion.log</string>
</dict>
</plist>
EOF
```

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.star-exam-companion.plist
```

On **Linux**, create the folder and save the file below as
`~/.config/systemd/user/star-exam-companion.service`. Replace `/path/to/star-exam-companion`,
`/path/to/node/bin` (`dirname "$(command -v node)"` prints it) and `/path/to/pnpm`
(`command -v pnpm` prints it); a systemd service does not see the `PATH` of your shell.

```bash
mkdir -p ~/.config/systemd/user
```

```ini
[Unit]
Description=Star Exam Companion

[Service]
WorkingDirectory=/path/to/star-exam-companion
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=PATH=/path/to/node/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/path/to/pnpm --dir quiz exec next start -H 127.0.0.1 -p 47830
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now star-exam-companion
```

```bash
loginctl enable-linger "$USER"
```

The last command keeps the service running when you are logged out.

**Windows** has no ready-made service here. Start the quiz by hand from Git Bash when you want it:
`NEXT_TELEMETRY_DISABLED=1 pnpm --dir quiz exec next start -H 127.0.0.1 -p 47830`. The certificate
and nginx steps work on Windows as [`docs/https.md`](docs/https.md) describes.

**5. Put nginx in front, on ports 80 and 443.** Install nginx first if you do not have it; the
commands for each system are in [`docs/https.md`](docs/https.md#4-serve-it-over-https). Save this as
`star-exam-companion.conf` with the full path to your `certs/` folder in both certificate lines. [`docs/https.md`](docs/https.md#4-serve-it-over-https)
says where it goes on macOS, Linux and Windows, and how to load it.

```nginx
server {
    listen              80 default_server;
    server_name         _;

    location / {
        # This machine and private network ranges only. Anything allowed here can save and
        # reset answers, so narrow it to your own network's range if you can.
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny  all;
        proxy_pass         http://127.0.0.1:47830;
        proxy_http_version 1.1;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}

server {
    listen              443 ssl default_server;
    server_name         _;
    ssl_certificate     /full/path/to/certs/quiz.crt;
    ssl_certificate_key /full/path/to/certs/quiz.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny  all;
        proxy_pass         http://127.0.0.1:47830;
        proxy_http_version 1.1;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

If nginx already has a default site on port 80, as Debian and Ubuntu do, remove it or drop
`default_server` from the first block. Allow ports 80 and 443 through the machine's firewall.

**6. Trust the certificate on each device.** Install `certs/quiz-ca.crt`: step-by-step instructions
for **iOS, Android, macOS, Windows and Linux** are in
[`docs/https.md`](docs/https.md#5-trust-the-certificate-on-each-device).

**7. Check it.** Open `https://ADDRESS/` on your phone. It loads with no warning. Add it to the home
screen, open **Progress**, and check that **Secure** says *Yes* and **Offline** says *Ready*. The
same address works over plain HTTP at `http://ADDRESS/`, without offline mode.

**Update, restart, stop and remove.** The running server keeps serving the build it started with,
and building underneath it can break pages, so to update: stop it, `git pull`, install, build,
start.

| | macOS | Linux |
|---|---|---|
| Restart | `launchctl kickstart -k gui/$UID/com.star-exam-companion` | `systemctl --user restart star-exam-companion` |
| Log | `tail -f ~/Library/Logs/star-exam-companion.log` | `journalctl --user -u star-exam-companion -f` |
| Stop and remove | `launchctl bootout gui/$UID/com.star-exam-companion`, then delete the plist | `systemctl --user disable --now star-exam-companion`, then delete the unit file |

To go back to an earlier version, check it out with git, install, build and restart. Your answers in
`quiz/scores-<exam>.jsonl` are not touched by any of this; copy that file before you re-clone. The
certificate lasts 825 days; see [Renewing or removing it](docs/https.md#renewing-or-removing-it) in
the guide. If `ADDRESS` ever changes, repeat steps 2 and 3 and trust the new certificate.

## Data and privacy

- **Your answers stay on your machine**, in `quiz/scores-<exam>.jsonl` and in the browser of each device
  you study on. Git ignores the scores file and its backups.
- **No accounts, analytics or tracking.** The app's own scripts and the start and dev commands
  here switch Next.js telemetry off.
- **Deleting your data:** **Reset progress** on the Progress page empties `quiz/scores-<exam>.jsonl`
  after copying it to `quiz/scores-backups/`. To erase everything, delete `quiz/scores-*.jsonl` and
  `quiz/scores-backups/`, then clear this site's data in each browser you studied in.
- **The online demo** is hosted by GitHub Pages, which, like any web host, sees visitors' IP
  addresses. The demo has no accounts, analytics or server of its own, and keeps your answers only
  in your browser's storage for the github.io site.
- **Read Aloud** fetches Google's course text live from Google's servers; whoever runs the quiz is
  responsible for following Google's terms for it. See [`NOTICE`](NOTICE).

## Project structure

```text
.
├── quiz/                 The Next.js app: pages, components, API routes and tests
├── pages-static/         The online demo's own files, laid out like quiz/
├── exams/                One exam pack per exam: glossary, scenes, sections, study questions
├── docs/https.md         HTTPS, certificates and offline mode on every platform
├── scripts/              make-cert.sh (HTTPS certificate), build-pages.sh (online demo)
├── .github/workflows/    Builds and deploys the online demo to GitHub Pages
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

The online demo is a static export of the same app. `bash scripts/build-pages.sh` builds it into
`pages-out/`; it works on a temporary copy, so `quiz/` is never changed. It replaces Voice Quiz,
Read Aloud and Progress with a panel that says they need the local install, and filters Practice
in the browser. The workflow in `.github/workflows/pages.yml` publishes it on every push to `main`.
Once, in the repository settings, set **Pages > Source** to **GitHub Actions**.

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
