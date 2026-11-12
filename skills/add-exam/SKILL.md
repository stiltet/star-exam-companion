---
name: add-exam
description: Add a new exam to the quiz from its name. Creates the exam, reads its Google Skills learning path in Google's order, captures every lesson, then writes the glossary, voice scenes, study topics and practice questions from official sources, and checks the result. Use as /add-exam <exam name>.
---

# Add exam

Given an exam name, this creates `exams/<id>/`, fills its course list from Google's own learning path, captures every lesson into the
private store, then writes the quiz content (sections, terms, glossary, voice scenes, study topics and practice questions) from official
Google sources, so the exam works with every feature of the app, and reports what is done and what is not. Nothing is invented: content
with no official source is left out and named as unfinished.

**Use a secondary Google account, never the one the user studies with.** Google Skills counts a lesson as completed when it is
opened, and the crawl opens every lesson on every run. The signed-in account's progress on each course and on the whole learning
path then shows as complete, such as 66% of a certification path, although nothing was studied. Tell the user this before the first
run, and make sure the browser is signed in with the secondary account. The crawl prints `Signed in as <address>` so the account
is always visible.

1. **Make the id.** Turn the exam name into an id: lower case words joined by hyphens, such as `professional-cloud-architect`. If
   `exams/<id>/` already exists, stop and tell the user.

2. **Find the three official addresses.** Search the web for the exam name and take only pages on `cloud.google.com`,
   `services.google.com` and `skills.google`:
   - the exam's certification page (`examPage`),
   - its exam guide, the PDF (`examGuide`),
   - its learning path on Google Skills, an address like `https://www.skills.google/paths/<number>`.

   From the certification page and the exam guide, also take the exam's number of questions, its length in minutes and its sections
   with their weights. If the learning path cannot be found, ask the user for its address; ask nothing else.

3. **Read the learning path.** The path's courses come from Google, never from memory. The browser this needs is the one the
   `capture-reading` skill describes in its step 1; follow that step first if the browser is not ready.

   ```bash
   pnpm --dir quiz reading:path <learning-path address> --json
   ```

   Keep the JSON it prints. It holds the path's title, its address and its courses, numbered in Google's order, each marked private.

4. **Create the exam folder.** The format is in `docs/exam-packs.md`. Write these files in `exams/<id>/`:
   - `pack.json`: `id`, `title` (the exam's short name), `certification` (its full name), `description` (one or two sentences from the
     certification page), `unnumberedLabel` (the exam guide's own label for tools in scope, or "Tools in scope"), `examPage`, `examGuide`,
     `learningPath` (the path's address), `exam` with `questions` and `minutes`, `reading` set to `true`, `links` with one entry
     `{ "label": "LEARNING PATH", "href": <the path's address> }`, and `sectionOf` as `{}`.
   - `courses.json`: the JSON from step 3 without its `title` field.
   - `sections.md`: the exam guide's sections, one line each, `Section N (title, ~X%)`, with the header another exam's file has.
   - `terms.txt`: only the comment lines another exam's file starts with (step 8 fills it).
   - `scenes.json`: `[]` (step 8 fills it).
   - `study.json`: `{ "sections": [], "questions": [] }` (step 8 fills it).
   - `glossary.md`: the header another exam's `glossary.md` has, up to its table header, with no rows (step 8 fills it).

5. **Capture every lesson.** Name the new exam, so only it is crawled:

   ```bash
   pnpm --dir quiz reading:crawl <id>
   ```

   The last block is the report: a `FINISHED`, `NOT FINISHED` or `STOPPED` headline, then each course as its number and title with its
   lesson counts and any problem. If it stops because the browser is not signed in, follow the one-time sign-in in the
   `capture-reading` skill and run it again.

6. **Move the courses with nothing to read.** The report marks a course with `–` and `no readable lessons` when it holds only labs,
   videos and quizzes. For each one, move its entry from `courses` to a `noReading` list in `courses.json`: keep its `id`, `template`
   and `title`, drop `provider`, and add `why` with this sentence: `This course is hands-on labs, videos and quizzes on Google Skills.
   It has no reading text to read aloud. Open the course on Google Skills.` Read Aloud then lists the course in its place, marked as
   having no text, and it no longer keeps the Unfinished notice up.

7. **Validate it.** This also proves the exam loads:

   ```bash
   pnpm --dir quiz reading:list <id>
   ```

   Check that every course shows its lessons saved and none is marked MISSING. A course the report named as having a lesson with no
   reading text is reported as it is, never hidden.

8. **Write the quiz content, one stage at a time, from official Google sources only.** The new exam must work with every feature of the
   app: Study, Practice, Voice quiz, the exam, Progress and Read Aloud. The finished Generative AI Leader exam,
   `exams/generative-ai-leader/`, is the example of every file below: open its file, copy its shape, never its words or facts. Every
   stage ends with the same command, run from the project folder, which must pass before the next stage starts. It names the file and
   row that breaks a rule:

   ```bash
   node --test
   ```

   Rules for all stages. Never invent a definition, a fact or a question: each one comes from the exam guide, the study guide, a Google
   Cloud documentation page or a Google Skills course, and is checked live on that page before it is written. Write in your own words;
   copy no course text, PDF text or logo. Content that cannot be sourced is left out and named as unfinished in step 9, never filled in
   from memory. Stage 1 is reading the sources: fetch the exam guide PDF and the pages it points to with `curl`, and use the captured
   lessons only to learn what to look up, never as text to copy.

   1. **Sections and facts.** `sections.md` and `pack.json` already hold the guide's sections, weights, questions and minutes from step 2.
      Check that the weights add up to 100. `sectionOf` in `pack.json` maps each study section id and topic id (stage 5) to its exam
      section number, such as `"google-cloud-offerings": "2"`; fill it as stage 5 creates the ids. Example: its `sections.md` and `pack.json`.
   2. **Terms.** `terms.txt` lists every term the exam guide names, one per line, spelled as the guide spells it, under its header
      comments. Example: its `terms.txt`. Take the terms from the guide's section bullets, and from the study guide's own headings where the guide
      has no bullets, never from memory.
   3. **Glossary.** `glossary.md` gets one row per term: `| Term | meaning | guide section | source |`, grouped under one heading per
      exam section, with the source keys explained in its header (study guide with page, exam guide, a documentation page, a course). A
      meaning is one or two sentences in your own words from that source. A product that Google renamed gets two rows, each pointing to the
      other with `**Renamed:** Old => New.` and the date checked. Example: its `glossary.md`. Every term in `terms.txt` needs a row.
   4. **Voice scenes.** `scenes.json` gets scenes that each make one decision with one binding constraint: `id`, `correct` (a glossary
      term), three `distractors` (other glossary terms), `scene`, `constraint`, optionally `guide` and `course`. A scene never names its own
      answer. Every term in `terms.txt` must be the correct answer of at least one scene, so write the scenes for the terms in order until
      none is left. Example: its `scenes.json`. The test `quiz/lib/round.test.ts` fails for each term no scene answers.
   5. **Study sections, topics and practice questions.** `study.json` gets one section per exam section with its weight, and for each
      section its topics: `officialDocs` (title and address), `concepts`, `examFocus`, `traps` and `studyQA` with an `officialSource` on every
      answer. Then the written practice questions: `sectionId`, `topicId`, `question`, four `options`, `correctIndex`, an `explanation`,
      three `whyOthersWrong`, an `officialDoc` and a `difficulty`, each built only from facts a topic already cites. Aim for about the same
      number of questions per section as its weight suggests; fewer is allowed and reported. Example: its `study.json`.

   If a stage is long, write it in parts and run `node --test` after each part. A stage that would cost many agent tokens (the practice
   questions especially) is done in the main session and reported to the owner first, with the estimate; never start a fan-out of
   agents without asking.

9. **Final checks.** All of these must pass, and each is named in the report:
   - `node --test` passes with the new exam in place.
   - `pnpm --dir quiz reading:list <id>` shows every course's lessons saved.
   - `QUIZ_EXAM=<id> pnpm --dir quiz build` succeeds, into its own folder (`QUIZ_DIST_DIR=.next-gate`), never over the served one.
   If any stage was left out, set `notice` in `pack.json` to a plain statement of what is missing, as `docs/exam-packs.md` says, so
   Read Aloud shows it.

10. **Report.** Give the exam id, the courses with number and title in Google's order, the verdict of each, the checks of steps 6, 7 and
    9, and the counts: terms, glossary rows, scenes, study sections and topics, practice questions. Say plainly what is not done and
    why (for example a term with no official source), never "done" when something is left out.
