/**
 * The certificate is what a phone must trust before it allows a service worker, so the ways it can
 * be wrong are the ways offline mode never starts: a missing name, a validity Apple refuses, a root
 * key left behind, or an overwritten root the devices already trust. The nginx block in
 * docs/https.md is checked too, since that page is the only place it lives.
 */
import { strict as assert } from 'node:assert';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import test, { describe, type TestContext } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/make-cert.sh');
const guide = readFileSync(path.join(root, 'docs/https.md'), 'utf8');
const nginxBlock = /```nginx\n([\s\S]*?)```/.exec(guide)?.[1] ?? '';

/** Every temp directory nginx would otherwise create under /var/lib/nginx, moved under `prefix/logs`. */
function nginxTempPaths(prefix: string): string {
  return ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi']
    .map((name) => `${name}_temp_path ${prefix}/logs/${name}_temp;`)
    .join('\n');
}

/** A command's exit status and output; never throws, so a missing program reads as a failed run. */
function runCommand(command: string, args: string[], options: SpawnSyncOptions = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000, ...options });
  return { status: result.status, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? result.error ?? '') };
}

function scratch(t: TestContext): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'quiz-cert-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function text(file: string): Promise<string> {
  const run = runCommand('openssl', ['x509', '-in', file, '-noout', '-text']);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
}

async function make(out: string, ...args: string[]) {
  return runCommand('bash', [script, out, ...args]);
}

describe('the home certificate', () => {
  test('make-cert.sh signs a server certificate for the IP that its root verifies, and keeps no root key', async (t) => {
    const out = path.join(scratch(t), 'certs');
    const run = await make(out, '10.0.0.7');
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(readdirSync(out).sort(), ['quiz-ca.crt', 'quiz.crt', 'quiz.key']);
    assert.equal(statSync(path.join(out, 'quiz.key')).mode & 0o777, 0o600);

    const verify = runCommand('openssl', ['verify', '-CAfile', path.join(out, 'quiz-ca.crt'), path.join(out, 'quiz.crt')]);
    assert.equal(verify.status, 0, verify.stderr);

    const server = await text(path.join(out, 'quiz.crt'));
    assert.match(server, /IP Address:10\.0\.0\.7/);
    assert.match(server, /DNS:localhost/);
    assert.match(server, /IP Address:127\.0\.0\.1/);
    assert.match(server, /TLS Web Server Authentication/);
    assert.match(server, /sha256WithRSAEncryption/);
    assert.match(server, /Public-Key: \(2048 bit\)/);
    const [notBefore, notAfter] = [/Not Before: (.+)/, /Not After : (.+)/].map((pattern) => Date.parse(server.match(pattern)?.[1] ?? ''));
    assert.ok((notAfter - notBefore) / 86_400_000 <= 825, 'Apple refuses a TLS certificate valid for more than 825 days');

    const ca = await text(path.join(out, 'quiz-ca.crt'));
    assert.match(ca, /CA:TRUE, pathlen:0/);
  });

  test('make-cert.sh puts a local host name in the certificate as a DNS name', async (t) => {
    const out = path.join(scratch(t), 'certs');
    const run = await make(out, 'quiz-mac.local');
    assert.equal(run.status, 0, run.stderr);
    assert.match(await text(path.join(out, 'quiz.crt')), /DNS:localhost, IP Address:127\.0\.0\.1, DNS:quiz-mac\.local/);
  });

  test('make-cert.sh covers localhost alone when no host is given', async (t) => {
    const out = path.join(scratch(t), 'certs');
    const run = await make(out);
    assert.equal(run.status, 0, run.stderr);
    assert.match(await text(path.join(out, 'quiz.crt')), /Subject Alternative Name: \n\s*DNS:localhost, IP Address:127\.0\.0\.1\n/);
  });

  test('make-cert.sh never overwrites a root the devices may already trust', async (t) => {
    const out = path.join(scratch(t), 'certs');
    mkdirSync(out);
    writeFileSync(path.join(out, 'quiz-ca.crt'), 'trusted');
    const run = await make(out, '10.0.0.7');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /already holds a certificate/);
    assert.equal(readFileSync(path.join(out, 'quiz-ca.crt'), 'utf8'), 'trusted');
  });

  test('make-cert.sh refuses something that is neither a host name nor an IPv4 address, and writes nothing', async (t) => {
    for (const host of ['evil.example;rm', 'a b', '-x', 'quiz_mac.local', '999.1.1.1', '1.2.3.256', `${'a'.repeat(64)}.local`]) {
      const out = path.join(scratch(t), 'certs');
      const run = await make(out, host);
      assert.notEqual(run.status, 0, host);
      assert.match(run.stderr, /not a host name or IPv4 address/, host);
      assert.equal(existsSync(out), false, host);
    }
  });

  test('make-cert.sh accepts a long host name, keeping it in subjectAltName', async (t) => {
    const long = `${'a'.repeat(60)}.${'b'.repeat(60)}.local`;
    const out = path.join(scratch(t), 'certs');
    const run = await make(out, long);
    assert.equal(run.status, 0, run.stderr);
    assert.match(await text(path.join(out, 'quiz.crt')), new RegExp(`DNS:${long.replaceAll('.', '\\.')}`));
  });

  test('make-cert.sh leaves the mode of a folder it did not make alone', async (t) => {
    const out = scratch(t);
    chmodSync(out, 0o755);
    const run = await make(out, '10.0.0.7');
    assert.equal(run.status, 0, run.stderr);
    assert.equal(statSync(out).mode & 0o777, 0o755);
  });

  test('make-cert.sh shows why openssl failed and leaves no half-made set', async (t) => {
    const dir = scratch(t);
    const bin = path.join(dir, 'bin');
    mkdirSync(bin);
    // An openssl that fails the way a broken install would, so the script's own handling is what is tested.
    writeFileSync(path.join(bin, 'openssl'), '#!/bin/sh\necho "simulated openssl fault" >&2\nexit 3\n');
    chmodSync(path.join(bin, 'openssl'), 0o755);
    const out = path.join(dir, 'certs');
    const run = runCommand('bash', [script, out, '10.0.0.7'], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /simulated openssl fault/);
    assert.deepEqual(readdirSync(out), []);
  });

  test('the guide\'s nginx block is the default server on 443 and passes Host and the protocol on', () => {
    assert.match(nginxBlock, /listen\s+443 ssl default_server;/);
    assert.match(nginxBlock, /proxy_set_header\s+Host\s+\$http_host;/);
    assert.match(nginxBlock, /proxy_set_header\s+X-Forwarded-Proto\s+\$scheme;/);
    assert.match(nginxBlock, /proxy_pass\s+http:\/\/127\.0\.0\.1:47830;/);
  });

  const nginx = ['/opt/homebrew/bin/nginx', '/usr/local/bin/nginx', '/usr/sbin/nginx'].find((file) => existsSync(file));
  test('the guide\'s nginx block passes nginx -t with a made certificate', { skip: !nginx && 'nginx is not installed' }, async (t) => {
    const prefix = scratch(t);
    mkdirSync(path.join(prefix, 'logs'));
    const certs = path.join(prefix, 'certs');
    const made = await make(certs, '10.0.0.7');
    assert.equal(made.status, 0, made.stderr);
    // nginx -t binds the listening port, and Linux refuses port 443 to an unprivileged user (macOS
    // allows it). The test moves it to a high port; the guide's own text is asserted above,
    // unchanged. readme.test.mts uses other ports, because test files run in parallel and a port
    // is only free by convention.
    const server = nginxBlock
      .replaceAll('/full/path/to/certs', certs)
      .replace(/(listen\s+)443\b/g, (_match, head: string) => `${head}28443`);
    writeFileSync(
      path.join(prefix, 'nginx.conf'),
      // The access log and the temp directories name places under the scratch folder: Linux packages
      // build nginx with absolute /var/log/nginx and /var/lib/nginx paths, which an unprivileged
      // test run cannot open or create.
      `pid ${prefix}/nginx.pid;\nerror_log ${prefix}/logs/error.log;\nevents {}\nhttp {\naccess_log ${prefix}/logs/access.log;\n${nginxTempPaths(prefix)}\n${server}\n}\n`
    );
    const run = runCommand(nginx!, ['-t', '-p', prefix, '-c', path.join(prefix, 'nginx.conf')]);
    assert.equal(run.status, 0, run.stderr);
  });
});
