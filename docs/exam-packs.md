# Exams

An exam is everything that makes the quiz the quiz for one exam. It is a folder,
`exams/<id>/`, and the app code holds no exam content. One install serves one exam: set
`QUIZ_EXAM=<id>` (default `generative-ai-leader`) for the exam a fresh install starts with, or
switch it any time at the bottom of the Progress page. The choice is kept in `quiz/active-exam.json`
(git ignores it) and every device follows it. Each switch appends one line to `quiz/exam-switches.log`
(`<ISO time> switched from <old> to <new>`, also ignored by git), beside the choice file; a switch to the exam
already served adds none. If the log cannot be written, the server reports the error and the switch still succeeds.

Adding an exam means adding a folder. No code changes. The steps for a pull request are at the
[end of this page](#add-an-exam-with-a-pull-request).

The `/add-exam <exam name>` skill ([`../skills/add-exam/SKILL.md`](../skills/add-exam/SKILL.md)) does the folder and the lesson
capture for you: it reads the exam's Google Skills learning path with `pnpm --dir quiz reading:path <address>`, writes `courses.json`
in Google's order, captures every lesson and checks the result. It then writes the quiz content (terms, glossary, scenes, study
topics and practice questions) from the exam guide and Google's pages, in stages that each end with `node --test`. Nothing is
invented: content with no official source is left out and named in the exam's `homeNotice` and `notice`.

## The folder

| File | What it holds |
|---|---|
| `pack.json` | `id` (the folder name), `title`, `certification`, `description` (a short description, shown on the home page above Exam Structure), `keywords` (optional: extra search keywords for the page metadata), `unnumberedLabel` (the Glossary and Flashcards group for a term the guide does not number, such as "Study guide"), `homeNotice` (optional: a plain statement that the exam is unfinished, shown as a yellow note on Home and on each of Study, Practice, Practice exam, Glossary, Flashcards and Voice quiz whose data the exam does not have yet), `notice` (optional: the same statement for the online demo's Read Aloud page; an exam with a `notice` may have no glossary rows; the local Read Aloud page computes its own note from the courses it can read), `examPage`, `examGuide`, `learningPath` (Google's official learning path, the home page button), `exam` (the Practice exam's `questions` and `minutes`, as the real exam's), `reading`, `links` (extra footer links), `notAsked` (optional: glossary terms no scene asks), and `sectionOf`, which maps each study section id in `study.json` to its exam-guide section number. |
| `glossary.md` | One term per row, each with its source: an official Google page or document. Never invent a definition. The header explains the row format; copy an existing exam's. |
| `sections.md` | The exam sections and their weights, one line each: `Section N (title, ~X%)`. |
| `terms.txt` | Every term the exam guide names, one per line. The validator checks each has a glossary row and is the answer to a voice scene, even if it is listed in `notAsked`. |
| `scenes.json` | The voice quiz's questions: `id`, `correct`, `distractors` (three), `scene`, `constraint`, and optionally `guide` and `course`. |
| `courses.json` | Only when `reading` is true: the learning path's courses for Read Aloud, below. |
| `study.json` | `sections` (the Study pages: topics, study Q and A, official docs) and `questions` (the written practice questions). |

`reading` is `true` for an exam that has an official course to read aloud, and then the exam
needs `courses.json`: `{ path, bundleBase, courses: [{ id, template, title, provider?, folder?, format? }] }`. `path` is
the learning path on Google Skills, `bundleBase` is the public Google Cloud Storage folder that
holds public courses' text, and each course gives its Skills number (`template`) and, unless it uses
the private provider, its folder there. `provider` is omitted for public Google bundles or set to
`"private"` for a course whose pages are saved by the user in a private store on this server. Private
courses do not have a public `folder` or `format`; their captured text is outside the repository and
build output. `QUIZ_PRIVATE_DIR` may point to a different absolute directory; otherwise the OS
app-data directory is used.
A private course is captured by `pnpm --dir quiz reading:crawl [<exam>]`, which saves each lesson through the private
store (the same store `POST /api/reading/private` writes to, which answers only a request that sends this install's token in `x-quiz-private-token`, a secret
kept in the store's folder as `.write-token`, so never one from the network) and keeps a per-course manifest of titles, addresses and
hashes beside it, never text. The README's "Private course readings" section describes it, and
[`../skills/capture-reading/SKILL.md`](../skills/capture-reading/SKILL.md) has the steps. A new exam needs no change to
either: the courses come from its `courses.json` entries with `"provider": "private"`.
`courses.json` may also hold `noReading`: `[{ id, template, title, why }]`, the path's courses that have no text to read
(a lab or video course, say). Read Aloud lists them in the one course list, in course order with the readable courses, each marked "No text to read aloud" with its `why`;
opening one shows `why` and a link to the course on Google Skills. Say in `why` only what its Skills page shows: a lab or video course lists no readings, and a course whose readings sit behind a login says so. Their ids continue after the readable courses' ids.
`format` is absent for a course stored as four JSON files, and `"rise"` for one Google stores as a single
`runtime-data.js` (its `folder` then ends where that file is, such as `T-XXXX/v1.0.0/EN`). A scene's optional `course` names one of those ids. An exam with no course to read sets it `false`: its Read Aloud page then says so and links to the learning path, rather than disappearing.

### Shapes of the data files

`scenes.json` is a list. Each scene: `id` (unique), `correct` (a glossary term), `distractors`
(three other glossary terms), `scene` (a short situation), `constraint` (the one fact that decides
it) and optionally `guide` and `course`. The scene's section comes from the `Guide` column of the
correct term's glossary row. A term whose row has "—" there needs `"guide": "3.1"` (its exam-guide
section) on every scene that asks it, or the exam test fails with "its guide section is not in
sections.md".

`study.json` is `{ sections, questions }`:

- `sections`: one per exam section, `{ id, title, weight, description, topics }`. Each topic is
  `{ id, title, officialDocs: [{ title, url }], concepts, examFocus, traps, studyQA }`, where
  `studyQA` is `[{ question, answer, officialSource }]`. Every `id` is a key of `sectionOf` in
  `pack.json`.
- `questions`: the written practice questions, `{ id, sectionId, topicId, question, options` (four),
  `correctIndex, explanation, whyOthersWrong` (three, one per wrong option)`, officialDoc,
  difficulty }`. Build each from facts a topic already cites.

## The rules an exam follows

- Every glossary row names an official source, and a changed row is checked against that page.
- A scene never names its own answer, and each answer is a glossary term.
- Section weights add up to 100.
- Google's course text, PDFs and logos are not copied in.

## Checking an exam

`node --test` runs the exam validator over every folder in `exams/`. It names the file and the
line that fails. An exam is ready when the whole run passes and `pnpm --dir quiz build` succeeds
with `QUIZ_EXAM=<id>`. The validator rejects private-reading directories and stored-record shapes
inside an exam. `scripts/build-pages.sh` also checks the exam, app and demo source trees against all
private records before exporting, including records from removed exams; the demo has no
Read Aloud routes or service worker.

## Running an exam

```bash
QUIZ_EXAM=<id> pnpm --dir quiz dev
```

Each exam keeps its own scores file, `quiz/scores-<id>.jsonl`, its own backups
(`quiz/scores-backups/scores-<id>-<time>.jsonl`) and its own browser storage, all named after the
exam, so two exams never mix answers and a copied file says which exam it is. An install that
studied before exams were named finds its old `quiz/scores.jsonl` and browser data moved to the
Generative AI Leader names the first time it runs, with a backup copy first. Night reading places
and cached recordings also belong to an exam. An older, unlabelled Night recording is assumed to
be Generative AI Leader's and remains available offline. An older Night page that does not name its
exam is refused a different exam's recording and asks to be reloaded, so it cannot store that
recording under the old unlabelled name.

The move to exam-named files is one way. To go back to an older build, copy
`quiz/scores-backups/scores-generative-ai-leader-before-exam-names.jsonl` to `quiz/scores.jsonl`.
Answers still waiting on a device sit under exam-named browser keys (for example
`quiz-outbox-generative-ai-leader`), which an older build cannot read: let each device sync before
you roll back. An older build cannot read a newly stored, exam-named Night recording either; store
it again after rolling back. If you roll back and later upgrade again, the plain `quiz/scores.jsonl` an older build wrote
is merged into `quiz/scores-generative-ai-leader.jsonl` by answer id at the first start, and moved to
`quiz/scores-backups/`. A device queue (answers waiting to send, refused answers and their reasons) that
holds text the app cannot read is kept, not deleted, under the same browser key with `-unreadable` added; a second, different unreadable text goes to `-unreadable-2`, then `-3`. Nothing removes these backups but clearing the site's data.

## Add an exam with a pull request

You need git and [Node 22](https://nodejs.org) with pnpm. No app code changes, only a new folder.

1. **Fork and branch.** Fork the repository on GitHub, clone your fork, and make a branch named
   `feat/exam-<id>`, where `<id>` is the exam's short name in lower case with hyphens, such as
   `data-engineer`.
2. **Copy an exam.** Copy the folder of a finished exam and name it `<id>`:

   ```bash
   cp -R exams/generative-ai-leader exams/<id>
   ```

3. **Fill in the files**, from the table above. Start with `pack.json` (names, links, the exam's real
   length) and `sections.md` (the exam guide's sections and their weights). Then write the glossary,
   the scenes and the study topics from Google's own exam guide and documentation. `id` in
   `pack.json` must be the folder name. If the exam has no official course to read aloud, set
   `reading` to `false` and delete `courses.json`.
4. **Check it.** Install, then run the tests. The exam test names the file and row that breaks a rule:

   ```bash
   pnpm --dir quiz install
   ```

   ```bash
   node --test
   ```

5. **Look at it.** Start the quiz on your exam and click through Study, Practice, Voice Quiz and the
   Exam:

   ```bash
   QUIZ_EXAM=<id> pnpm --dir quiz exec next dev -H 127.0.0.1
   ```

   If you ever switched exams on the Progress page of this checkout, that choice wins over `QUIZ_EXAM`: delete
   `quiz/active-exam.json` first, or switch on Progress. A chosen exam with any file that stops loading, or a
   glossary that does not parse, is ignored, so Progress still opens and you can switch back, and the switch
   refuses such an exam.

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

An exam that is not finished is welcome as long as it passes `node --test`: list only the terms you
have covered in `terms.txt`, set `homeNotice` and `notice` in `pack.json` to a plain statement of what is missing (the
quiz shows `homeNotice` on Home and on the pages whose data is missing), and say the same in the pull request. Remove both
when nothing is missing. Keep a pull request to one exam; split a large exam into one pull
request per file group (for example glossary and scenes first, study data after). A maintainer reviews the
content against Google's pages, and runs the full gate before merging.
