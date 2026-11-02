# Exam packs

An exam pack is everything that makes the quiz the quiz for one exam. It is a folder,
`exams/<id>/`, and the app code holds no exam content. One install serves one exam: set
`QUIZ_EXAM=<id>` (default `generative-ai-leader`) before the build and the start.

Adding an exam means adding a folder. No code changes.

## The folder

| File | What it holds |
|---|---|
| `pack.json` | `id` (the folder name), `title`, `certification`, `examPage`, `examGuide`, `reading`, `links` (extra footer links), `notAsked` (optional: glossary terms no scene asks), and `sectionOf`, which maps each study section id in `study.json` to its exam-guide section number. |
| `glossary.md` | One term per row, each with its source: an official Google page or document. Never invent a definition. The header explains the row format; copy an existing pack's. |
| `sections.md` | The exam sections and their weights, one line each: `Section N (title, ~X%)`. |
| `terms.txt` | Every term the exam guide names, one per line. The validator checks each is the answer to a voice scene. |
| `scenes.json` | The voice quiz's questions: `id`, `correct`, `distractors` (three), `scene`, `constraint`, and optionally `guide` and `course`. |
| `study.json` | `sections` (the Study pages: topics, study Q and A, official docs) and `questions` (the written practice questions). |

`reading` is `true` only for a pack whose exam has an official course to read aloud. That feature
still reads one fixed course list, so a new pack sets it `false`.

## The rules a pack follows

- Every glossary row names an official source, and a changed row is checked against that page.
- A scene never names its own answer, and each answer is a glossary term.
- Section weights add up to 100.
- Google's course text, PDFs and logos are not copied in.

## Checking a pack

`node --test` runs the pack validator over every folder in `exams/`. It names the file and the
line that fails. A pack is ready when the whole run passes and `pnpm --dir quiz build` succeeds
with `QUIZ_EXAM=<id>`.

## Running a pack

```bash
QUIZ_EXAM=<id> pnpm --dir quiz dev
```

Each exam keeps its own scores file (`quiz/scores-<id>.jsonl`; the default exam keeps
`quiz/scores.jsonl`) and its own browser storage, so two installs never mix answers.
