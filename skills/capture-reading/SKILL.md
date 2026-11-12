---
name: capture-reading
description: Save the private Google Skills course lessons of every exam on this server (or one named exam) as private readings, then check the result. Use when Read Aloud says it is Unfinished, or the user asks to capture, refresh or check the private course readings.
---

# Capture reading

Saves each lesson of every private course as a private reading, outside the repository, and checks that nothing is missing
or changed. The command does the reading with no AI and no tokens. This skill is the steps around it, so any AI tool or a
person can follow it.

**Use a secondary Google account, never the one the user studies with.** Google Skills counts a lesson as completed when it is
opened, and the crawl opens every lesson on every run. The signed-in account's progress on each course and on the whole learning
path then shows as complete, such as 66% of a certification path, although nothing was studied. Tell the user this before the first
run, and make sure the browser is signed in with the secondary account. The crawl prints `Signed in as <address>` so the account
is always visible.

1. **Check the browser.** The command uses a separate Chrome for Testing (not the user's everyday Chrome) with its own
   profile folder, and starts it headless itself, so no window opens and nothing has to be started by hand. Chrome ignores a
   debugging port on its default profile, so this separate browser is required
   ([Chrome's explanation](https://developer.chrome.com/blog/remote-debugging-port)). Check that it is installed:

   ```bash
   pnpm --dir quiz exec playwright install chromium
   ```

   The first time only, the Google account must be known to that browser's profile. If the crawl says it is not signed in
   to Google Skills, stop and ask the user to do this once (it opens a window, so the user starts it, never an agent):

   ```bash
   open -n -a "$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/"Google Chrome for Testing.app" | tail -1)" --args --user-data-dir="$HOME/Library/Application Support/star-exam-companion/cft-profile"
   ```

   The user signs in to Google Skills there, then quits that window with the menu command (Cmd+Q), so it saves the profile. Later runs need no
   window: the command signs in itself, by pressing the browser's **Continue as** button for the saved Google account or, when
   that prompt does not appear, the site's **Sign in** and **Sign in with Google** buttons. With several Google accounts in that
   browser, set `READING_GOOGLE_ACCOUNT` to the account's address to choose one. With it set, the command stops before it opens a
   lesson if a different account turns out to be signed in, because opening lessons marks them completed on that account.

   If a Chrome for Testing is already running on port 9222, the command attaches to it and leaves it running.

2. **Run the command.** From the project folder. With no argument it covers every exam on the server; a name limits it to one:

   ```bash
   pnpm --dir quiz reading:crawl
   ```

   ```bash
   pnpm --dir quiz reading:crawl <exam>
   ```

   After signing in it prints `Signed in as <address>`, read from the site's account settings page, so it is plain which Google
   account is being used. If it cannot tell, it says so.

   It reads every lesson on every run, compares it with the saved copy, and saves any lesson whose text changed (naming it
   first). It prints one progress line per page (live and in place in a terminal) and pauses 2 to 15 seconds between pages.
   Stopping it with Ctrl-C is safe; the next run starts again from the first lesson and checks them all.
   A video lesson is saved by its title only: the crawl never opens a video page and keeps no transcript. Read Aloud shows it with a
   Watch the video button that opens it on Google Skills. Run the crawl again after an update to add the videos a course lists.
   A lesson delivered as a PDF has no page text, so the command fetches the PDF in memory and reads its text with the
   project's PDF module (`quiz/lib/pdf-text.ts`); nothing is saved to disk.

   Every run also writes a log file (the last line of the output is `Log: <path>`), with one line per event and no lesson text.
   When a run fails or looks wrong, run it again with `--debug` (`pnpm --dir quiz reading:crawl <exam> --debug`) and read the log
   before guessing: it shows the sign-in route, each lesson's outcome, every retry with its error and, with `--debug`, the addresses visited.

3. **Read the report.** It ends with one headline and then each course, as its number and title, with its lesson counts
   (new, updated, unchanged) and any problem on its own line:
   - `FINISHED`: every lesson of every course is accounted for.
   - `NOT FINISHED`: at least one course is incomplete. The problem lines name what is missing (not accounted for, no
     reading text, failed).
   - `STOPPED`: the run was stopped (Ctrl-C, or a closed browser) and says where.

   A course Google changed since the last run also says what (lessons added, removed or reordered, an address changed).
   The list of exams at the top says which exams have nothing to capture.

4. **Validate it.** Do not trust the verdict alone. Run:

   ```bash
   pnpm --dir quiz reading:list <exam>
   ```

   Check that for each course the lessons listed equal the lessons saved plus those reported empty or failed, that every
   title is accounted for, and that no lesson is marked MISSING without being named in the report. Say what you checked.

5. **If lesson text changed**, the report names those lessons and says they were saved again. Tell the user which ones.

6. **Finish with the verdicts.** Report the verdict of every course as the command printed it, and which checks of step 4 you
   ran. Never say the capture is done without a verdict for each course.
