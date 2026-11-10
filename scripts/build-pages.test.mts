/**
 * build-pages.sh makes the GitHub Pages demo. The ways it can be wrong: it deletes a folder it did not
 * make, it builds with the wrong base path so every link and icon 404s, it ships a server route that
 * cannot run on static hosting, or it leaves the real Voice Quiz where the demo's panel should be.
 */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { describe, type TestContext } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/build-pages.sh');
const hasPnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8' }).status === 0;

function scratch(t: TestContext): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'build-pages-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Every .html file under a folder. */
function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return [full];
  });
}

function build(out: string, env: Record<string, string> = {}) {
  const result = spawnSync('bash', [script, out], { encoding: 'utf8', timeout: 800_000, env: { ...process.env, ...env } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('the GitHub Pages build', () => {
  test('it refuses to replace a folder it did not make, and leaves it alone', (t) => {
    const out = path.join(scratch(t), 'site');
    mkdirSync(out);
    writeFileSync(path.join(out, 'precious.txt'), 'mine');
    const run = build(out);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /was not made by this script/);
    assert.equal(readFileSync(path.join(out, 'precious.txt'), 'utf8'), 'mine');
  });

  test('it refuses a base path that does not start with a slash', (t) => {
    const run = build(path.join(scratch(t), 'site'), { QUIZ_BASE_PATH: 'demo' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /QUIZ_BASE_PATH must be empty or start with \//);
  });

  test('it refuses a private reading store located inside the repository', (t) => {
    const out = path.join(scratch(t), 'site');
    const run = build(out, { QUIZ_PRIVATE_DIR: path.join(root, 'quiz/private-reading-fixture') });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Private readings must be stored outside the repository/);
    assert.equal(existsSync(out), false);
  });

  test('the demo files that replace the server features exist, laid out like quiz/', () => {
    for (const page of ['voice', 'read', 'progress']) {
      const file = path.join(root, 'pages-static/app', page, 'page.tsx');
      assert.ok(existsSync(file), file);
      assert.match(readFileSync(file, 'utf8'), /LocalOnlyPanel/);
    }
    // Practice filters in the browser on the demo; the real page, which filters on the server, stays.
    assert.match(readFileSync(path.join(root, 'pages-static/app/practice/page.tsx'), 'utf8'), /PracticeView/);
    for (const file of ['pages-static/components/practice-view.tsx', 'pages-static/lib/practice-filter.ts']) {
      assert.ok(existsSync(path.join(root, file)), file);
    }
    assert.match(readFileSync(path.join(root, 'quiz/app/practice/page.tsx'), 'utf8'), /searchParams/);
    // Both Practice pages say their empty-filter message the same way: a status a screen reader announces.
    for (const file of ['quiz/app/practice/page.tsx', 'pages-static/components/practice-view.tsx']) {
      assert.match(readFileSync(path.join(root, file), 'utf8'), /<Text variant="notice" role="status">No questions available/, file);
    }
  });

  test(
    'it exports the whole demo under the base path, with no server routes, and can run again over its own output',
    { skip: !hasPnpm && 'pnpm is not installed', timeout: 1_700_000 },
    (t) => {
      const out = path.join(scratch(t), 'site');
      const privateRoot = path.join(scratch(t), 'private');
      const pageId = '1801';
      const privateText = 'Synthetic private fixture text; not course material.';
      const courseDir = path.join(privateRoot, 'agentic-architect', '12');
      mkdirSync(courseDir, { recursive: true });
      writeFileSync(path.join(courseDir, `${createHash('sha256').update(pageId).digest('hex')}.json`), JSON.stringify({
        pageId,
        title: 'Synthetic private fixture',
        text: privateText,
        savedAt: '2026-01-01T00:00:00.000Z',
      }));
      const privateEnv = { QUIZ_BASE_PATH: '/demo-test', QUIZ_PRIVATE_DIR: privateRoot };
      const first = build(out, privateEnv);
      assert.equal(first.status, 0, first.stderr + first.stdout.slice(-2000));

      assert.ok(existsSync(path.join(out, '.nojekyll')));
      const home = readFileSync(path.join(out, 'index.html'), 'utf8');
      assert.match(home, /href="\/demo-test\/favicon\.png"/, 'the icon must carry the base path');
      assert.match(home, /Online demo\./, 'every page carries the demo banner');
      assert.doesNotMatch(home, /href="\/favicon\.png"/);
      assert.match(home, /rel="manifest" href="\/demo-test\/manifest\.webmanifest"/, 'Android installs from the manifest');
      const manifest = JSON.parse(readFileSync(path.join(out, 'manifest.webmanifest'), 'utf8'));
      assert.equal(manifest.start_url, '/demo-test/');
      assert.equal(manifest.scope, '/demo-test/');
      assert.ok(manifest.icons.every((icon: { src: string }) => icon.src.startsWith('/demo-test/')), 'icons carry the base path');

      // The three features that need the local install say so, instead of running.
      for (const page of ['voice', 'read', 'progress']) {
        assert.match(readFileSync(path.join(out, page, 'index.html'), 'utf8'), /runs on your computer/, page);
      }
      // The demo cannot read private copies, so its Read page for the second exam says Unfinished, rendered, not just pack metadata.
      const staticRead = readFileSync(path.join(out, 'agentic-architect', 'read', 'index.html'), 'utf8');
      assert.match(staticRead, /role="status"[^>]*>Unfinished: Read Aloud has public text for eight courses/);
      assert.match(staticRead, /runs on your computer/);
      // The demo's Practice page announces its messages to a screen reader, as the real page does.
      assert.match(readFileSync(path.join(out, 'practice', 'index.html'), 'utf8'), /role="status"[^>]*>Loading questions/);
      // What a static host can serve is there; what needs a server is not.
      for (const page of ['practice', 'exam', 'flashcards', 'glossary', 'about', 'study/fundamentals']) {
        assert.ok(existsSync(path.join(out, page, 'index.html')), page);
      }
      for (const gone of ['api', 'sw.js', 'read/capture', 'read/night']) {
        assert.equal(existsSync(path.join(out, gone)), false, gone);
      }
      // Read Aloud is only its panel: no course or reading page may leak into the export.
      const readFolders = readdirSync(path.join(out, 'read'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
      assert.deepEqual(readFolders.map((entry) => entry.name), []);
      assert.equal(
        filesUnder(out).some((file) => readFileSync(file).includes(Buffer.from(privateText))),
        false,
        'private reading text must not appear in the static build',
      );

      // Every link, script and image on every page is under the base path, so none 404 on Pages.
      for (const file of htmlFiles(out)) {
        for (const [, url] of readFileSync(file, 'utf8').matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
          assert.ok(url!.startsWith('/demo-test/') || url!.startsWith('//'), `${path.relative(out, file)} points at ${url}, outside the base path`);
        }
      }

      // Every other exam is its own copy of the demo under <base>/<pack id>/, and each copy links them all.
      const other = path.join(out, 'agentic-architect');
      assert.ok(existsSync(path.join(other, 'index.html')), 'the second exam has its own demo');
      const otherHome = readFileSync(path.join(other, 'index.html'), 'utf8');
      assert.match(otherHome, /PROFESSIONAL AGENTIC ARCHITECT/);
      assert.match(otherHome, /href="\/demo-test\/agentic-architect\/favicon\.png"/, 'the second exam carries its own base path');
      // components/demo-exams.tsx uses components/atoms/page-link.tsx for each pack choice.
      for (const page of [home, otherHome]) {
        assert.match(page, /href="\/demo-test\/"[^>]*>Generative AI Leader</, 'the default exam is linked at the root');
        assert.match(page, /href="\/demo-test\/agentic-architect\/"[^>]*>Professional Agentic Architect</, 'the other exam is linked under its name');
      }
      assert.match(home, /href="\/demo-test\/"[^>]*aria-current="page"[^>]*>Generative AI Leader</);
      assert.match(otherHome, /href="\/demo-test\/agentic-architect\/"[^>]*aria-current="page"[^>]*>Professional Agentic Architect</);

      // A second run replaces its own output instead of refusing it.
      const second = build(out, privateEnv);
      assert.equal(second.status, 0, second.stderr + second.stdout.slice(-2000));
    },
  );
});
