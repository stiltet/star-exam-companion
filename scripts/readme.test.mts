/**
 * The README is the first thing a stranger follows, so its claims are held to the code: the nginx
 * file it prints must load, every link and anchor must resolve, every setting the quiz reads must be
 * documented, and no real home-network address may be published in a public file.
 */
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { describe, type TestContext } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const readme = read('README.md');

/** Every temp directory nginx would otherwise create under /var/lib/nginx, moved under `prefix/logs`. */
function nginxTempPaths(prefix: string): string {
  return ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi']
    .map((name) => `${name}_temp_path ${prefix}/logs/${name}_temp;`)
    .join('\n');
}

function scratch(t: TestContext): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'readme-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
const anchor = (heading: string) => heading.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/ /g, '-');

/** Every quiz/ source file that is not a test. */
function quizSources(dir = path.join(root, 'quiz')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', 'public'].includes(entry.name) || entry.name.startsWith('.next')) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return quizSources(full);
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('the README', () => {
  test('every relative link points at a file or folder that exists, and every anchor at a heading', () => {
    const headings = new Set([...readme.matchAll(/^#{1,6} (.+)$/gm)].map((m) => anchor(m[1]!)));
    for (const [, target] of readme.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:)/.test(target!)) continue;
      const [file, hash] = target!.split('#');
      if (file) {
        assert.ok(existsSync(path.join(root, file)), `${target} does not exist`);
        if (hash && file.endsWith('.md')) {
          const doc = read(file);
          const docHeadings = new Set([...doc.matchAll(/^#{1,6} (.+)$/gm)].map((m) => anchor(m[1]!)));
          assert.ok(docHeadings.has(hash), `${target}: no such heading`);
        }
      } else if (hash) {
        assert.ok(headings.has(hash), `#${hash}: no such heading in the README`);
      }
    }
  });

  test('every QUIZ_ and NIGHT_ setting the quiz reads is documented, or is a build setting of the demo', () => {
    const buildSettings = new Set(['QUIZ_STATIC', 'QUIZ_BASE_PATH', 'QUIZ_COMMIT']);
    const used = new Set<string>();
    for (const file of quizSources()) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(/process\.env\.((?:QUIZ|NIGHT)_[A-Z0-9_]+)/g)) used.add(name!);
    }
    assert.ok(used.has('QUIZ_LAN_HOST') && used.has('QUIZ_SCORES_FILE'), 'the scan found the settings it knows about');
    for (const name of used) {
      if (buildSettings.has(name)) assert.ok(read('scripts/build-pages.sh').includes(name), `${name} is not set by build-pages.sh`);
      else assert.ok(readme.includes(`\`${name}\``), `${name} is read by the quiz but not in the README`);
    }
  });

  test('no real home-network address is published in a public file', () => {
    for (const file of ['README.md', 'NOTICE', 'docs/https.md', 'scripts/make-cert.sh', 'scripts/build-pages.sh', '.github/workflows/pages.yml']) {
      const found = read(file).match(/\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b(?!\/\d)/g);
      assert.equal(found, null, `${file} names a home-network address: ${found}`);
    }
  });

  test("the online demo's setup link and its commands still match the README", () => {
    const headings = new Set([...readme.matchAll(/^#{1,6} (.+)$/gm)].map((m) => anchor(m[1]!)));
    const hash = /SETUP_URL = "[^"#]*#([^"]+)"/.exec(read('quiz/lib/static-demo.ts'))?.[1];
    assert.ok(hash && headings.has(hash), `the demo links to #${hash}, which is not a README heading`);
    const commands = /\{`([\s\S]*?)`\}/.exec(read('quiz/components/local-only-panel.tsx'))?.[1]?.split('\n') ?? [];
    assert.ok(commands.length >= 5, 'the panel shows the five commands');
    for (const command of commands) assert.ok(readme.includes(command), `the panel's "${command}" is not in the README`);
  });

  const nginx = ['/opt/homebrew/bin/nginx', '/usr/local/bin/nginx', '/usr/sbin/nginx'].find((file) => existsSync(file));
  test(
    'the nginx file it prints passes nginx -t, with a certificate made by make-cert.sh',
    { skip: !nginx && 'nginx is not installed' },
    (t) => {
      const block = /```nginx\n([\s\S]*?)```/.exec(readme)?.[1] ?? '';
      assert.match(block, /listen\s+80 default_server;/);
      assert.match(block, /listen\s+443 ssl default_server;/);
      assert.match(block, /proxy_pass\s+http:\/\/127\.0\.0\.1:47830;/);
      assert.match(block, /proxy_set_header\s+Host\s+\$http_host;/);

      const prefix = scratch(t);
      mkdirSync(path.join(prefix, 'logs'));
      const certs = path.join(prefix, 'certs');
      const made = spawnSync('bash', [path.join(root, 'scripts/make-cert.sh'), certs, '127.0.0.1'], { encoding: 'utf8' });
      assert.equal(made.status, 0, made.stderr);
      // nginx -t binds the listening ports, and Linux refuses ports 80 and 443 to an unprivileged
      // user (macOS allows them). The test moves them to high ports; the README's own text is
      // asserted above, unchanged. make-cert.test.mts uses other ports, because test files run in
      // parallel and a port is only free by convention.
      const server = block
        .replaceAll('/full/path/to/certs', certs)
        .replace(/(listen\s+)443\b/g, (_match, head: string) => `${head}18443`)
        .replace(/(listen\s+)80\b/g, (_match, head: string) => `${head}18080`);
      writeFileSync(
        path.join(prefix, 'nginx.conf'),
        // The access log and the temp directories name places under the scratch folder: Linux packages
        // build nginx with absolute /var/log/nginx and /var/lib/nginx paths, which an unprivileged
        // test run cannot open or create.
        `pid ${prefix}/nginx.pid;\nerror_log ${prefix}/logs/error.log;\nevents {}\nhttp {\naccess_log ${prefix}/logs/access.log;\n${nginxTempPaths(prefix)}\n${server}\n}\n`,
      );
      const run = spawnSync(nginx!, ['-t', '-p', prefix, '-c', path.join(prefix, 'nginx.conf')], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr);
    },
  );

  test('the macOS login service it prints is a valid property list that starts the quiz on 47830', { skip: process.platform !== 'darwin' && 'plutil is macOS only' }, (t) => {
    const script = /```bash\nREPO="\$\(pwd\)"\n([\s\S]*?)\n```/.exec(readme)?.[1] ?? '';
    const plist = /<<EOF\n([\s\S]*?)\nEOF/.exec(script)?.[1] ?? '';
    assert.match(plist, /<key>Label<\/key><string>com\.star-exam-companion<\/string>/);
    assert.match(plist, /pnpm start:local -p 47830/);
    const file = path.join(scratch(t), 'service.plist');
    writeFileSync(file, plist.replaceAll('$REPO', '/tmp/repo').replaceAll('$HOME', '/tmp/home'));
    const lint = spawnSync('plutil', ['-lint', file], { encoding: 'utf8' });
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
  });
});

describe('pnpm runs from the root', () => {
  const scripts = (file: string) => JSON.parse(read(file)).scripts as Record<string, string>;

  test('every quiz script is also a root script that forwards to it, and gate runs the unit tests first', () => {
    const quiz = scripts('quiz/package.json');
    const top = scripts('package.json');
    assert.deepEqual(Object.keys(top).sort(), Object.keys(quiz).sort());
    for (const name of Object.keys(quiz).filter((n) => n !== 'gate')) {
      assert.equal(top[name], `pnpm --dir quiz ${name}`, name);
    }
    assert.equal(top.gate, 'node --test && pnpm e2e');
  });

  test('the pnpm-workspace.yaml at the root installs quiz, and the README never tells the reader to pass --dir quiz', () => {
    assert.match(read('pnpm-workspace.yaml'), /^packages:\n {2}- quiz$/m);
    assert.doesNotMatch(readme, /--dir quiz/);
  });
});
