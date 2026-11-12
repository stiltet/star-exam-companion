# Contributing

Thanks for helping. Star Exam Companion studies one Google Cloud exam per install, and each exam is a
data-only **exam** under [`exams/`](exams/).

## Add a new exam

1. Read [`docs/exam-packs.md`](docs/exam-packs.md): the folder, the shape of each file, the rules and
   the pull-request steps.
2. Copy a finished exam, fill it in from Google's own exam guide and documentation, and run
   `node --test` until it passes.
3. Run the quiz on your exam (`QUIZ_EXAM=<id>`), click through every page, and open one pull request
   for that exam only.

## Change the app

- Keep each pull request to one change, and add or update tests.
- Install once, then run the complete gate before you open the pull request:

  ```bash
  pnpm --dir quiz install
  ```

  ```bash
  pnpm --dir quiz exec playwright install chromium webkit
  ```

  ```bash
  pnpm --dir quiz gate
  ```

- Update the [README](README.md) when a change alters what the app does or how to run it.

## Content rules

- Every glossary row names an official Google source, and a changed row is checked against that page.
- Never copy Google's course text, PDFs or logos. Write short summaries in your own words, with links.
- Never put names, contact details, scores or other personal data in any file.

## Bugs, ideas and security

Open a [GitHub issue](https://github.com/stiltet/star-exam-companion/issues). Report security problems
privately through the repository's **Security** tab, not in a public issue.
