# Exam packs

An exam pack is everything that makes the quiz the quiz for one exam. It is a folder,
`exams/<id>/`, and the app code holds no exam content. One install serves one exam: set
`QUIZ_EXAM=<id>` (default `generative-ai-leader`) for the exam a fresh install starts with, or
switch it any time at the bottom of the Progress page. The choice is kept in `quiz/active-exam.json`
(git ignores it) and every device follows it.

Adding an exam means adding a folder. No code changes.

## The folder

| File | What it holds |
|---|---|
| `pack.json` | `id` (the folder name), `title`, `certification`, `description` (a short description, shown on the home page above Exam Structure), `unnumberedLabel` (the Glossary and Flashcards group for a term the guide does not number, such as "Study guide"), `examPage`, `examGuide`, `learningPath` (Google's official learning path, the home page button), `exam` (the Practice exam's `questions` and `minutes`, as the real exam's), `reading`, `links` (extra footer links), `notAsked` (optional: glossary terms no scene asks), and `sectionOf`, which maps each study section id in `study.json` to its exam-guide section number. |
| `glossary.md` | One term per row, each with its source: an official Google page or document. Never invent a definition. The header explains the row format; copy an existing pack's. |
| `sections.md` | The exam sections and their weights, one line each: `Section N (title, ~X%)`. |
| `terms.txt` | Every term the exam guide names, one per line. The validator checks each is the answer to a voice scene. |
| `scenes.json` | The voice quiz's questions: `id`, `correct`, `distractors` (three), `scene`, `constraint`, and optionally `guide` and `course`. |
| `courses.json` | Only when `reading` is true: the learning path's courses for Read Aloud, below. |
| `study.json` | `sections` (the Study pages: topics, study Q and A, official docs) and `questions` (the written practice questions). |

`reading` is `true` for a pack whose exam has an official course to read aloud, and then the pack
needs `courses.json`: `{ path, bundleBase, courses: [{ id, template, title, folder }] }`. `path` is
the learning path on Google Skills, `bundleBase` is the public Google Cloud Storage folder that
holds the courses' text, and each course gives its Skills number (`template`) and its folder there.
A scene's optional `course` names one of those ids. A pack with no course to read sets it `false`.

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

Each exam keeps its own scores file, `quiz/scores-<id>.jsonl`, its own backups
(`quiz/scores-backups/scores-<id>-<time>.jsonl`) and its own browser storage, all named after the
exam, so two exams never mix answers and a copied file says which exam it is. An install that
studied before exams were named finds its old `quiz/scores.jsonl` and browser data moved to the
Generative AI Leader names the first time it runs, with a backup copy first.
