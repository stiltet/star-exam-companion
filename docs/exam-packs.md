# Exam packs

An exam pack is everything that makes the quiz the quiz for one exam. It is a folder,
`exams/<id>/`, and the app code holds no exam content. One install serves one exam: set
`QUIZ_EXAM=<id>` (default `generative-ai-leader`) for the exam a fresh install starts with, or
switch it any time at the bottom of the Progress page. The choice is kept in `quiz/active-exam.json`
(git ignores it) and every device follows it.

Adding an exam means adding a folder. No code changes. The steps for a pull request are at the
[end of this page](#add-an-exam-with-a-pull-request).

## The folder

| File | What it holds |
|---|---|
| `pack.json` | `id` (the folder name), `title`, `certification`, `description` (a short description, shown on the home page above Exam Structure), `unnumberedLabel` (the Glossary and Flashcards group for a term the guide does not number, such as "Study guide"), `notice` (optional: a plain statement that the pack is unfinished, shown on the home, Practice and Exam pages), `examPage`, `examGuide`, `learningPath` (Google's official learning path, the home page button), `exam` (the Practice exam's `questions` and `minutes`, as the real exam's), `reading`, `links` (extra footer links), `notAsked` (optional: glossary terms no scene asks), and `sectionOf`, which maps each study section id in `study.json` to its exam-guide section number. |
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

The move to exam-named files is one way. To go back to an older build, copy
`quiz/scores-backups/scores-generative-ai-leader-before-exam-names.jsonl` to `quiz/scores.jsonl`.

## Add an exam with a pull request

You need git and [Node 22](https://nodejs.org) with pnpm. No app code changes, only a new folder.

1. **Fork and branch.** Fork the repository on GitHub, clone your fork, and make a branch named
   `feat/exam-<id>`, where `<id>` is the exam's short name in lower case with hyphens, such as
   `data-engineer`.
2. **Copy a pack.** Copy the folder of a finished pack and name it `<id>`:

   ```bash
   cp -R exams/generative-ai-leader exams/<id>
   ```

3. **Fill in the files**, from the table above. Start with `pack.json` (names, links, the exam's real
   length) and `sections.md` (the exam guide's sections and their weights). Then write the glossary,
   the scenes and the study topics from Google's own exam guide and documentation. `id` in
   `pack.json` must be the folder name. If the exam has no official course to read aloud, set
   `reading` to `false` and delete `courses.json`.
4. **Check it.** Install, then run the tests. The pack test names the file and row that breaks a rule:

   ```bash
   pnpm --dir quiz install
   ```

   ```bash
   node --test
   ```

5. **Look at it.** Start the quiz on your pack and click through Study, Practice, Voice Quiz and the
   Exam:

   ```bash
   QUIZ_EXAM=<id> pnpm --dir quiz exec next dev -H 127.0.0.1
   ```

   If you ever switched exams on the Progress page of this checkout, that choice wins over `QUIZ_EXAM`: delete
   `quiz/active-exam.json` first, or switch on Progress. A chosen pack whose `pack.json` stops loading is
   ignored, so Progress still opens and you can switch back.

6. **Open the pull request** against `main`. Change only `exams/<id>/` and, if you want it listed, one
   row in the README's *Choose your exam* table. Say in the description which exam it is, link its
   exam guide, and tick the checklist below.

### The checklist

- [ ] Every glossary row has a source, an official Google page or document, and its meaning was
      checked against that page.
- [ ] Scenes are decisions with one binding constraint. A scene never names its own answer, and the
      three wrong options are real terms from the glossary.
- [ ] `sections.md` weights add up to 100, and `terms.txt` lists every term the exam guide names.
- [ ] No copied course text, PDFs or logos. Short summaries in your own words, with links.
- [ ] `node --test` passes.
- [ ] No names, contact details, scores or other personal data in any file.

A pack that is not finished is welcome as long as it passes `node --test`: list only the terms you
have covered in `terms.txt` and say what is missing in the pull request. A maintainer reviews the
content against Google's pages, and runs the full gate before merging.
