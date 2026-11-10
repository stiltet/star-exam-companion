/**
 * The browser-test server refuses to run `say`, so no test is ever heard (content-fixture.mjs). A voice
 * clip that a page still fetches during a test therefore answers 500, and the browser logs that as an
 * error. A request that goes through the offline service worker skips the test's own route stub, so which
 * run it happens in depends on timing. A spec about something else than voice may declare it expected;
 * any other 500, and any other path, still fails the test.
 */
export function isRefusedClipFetch(message: string, pathname: string): boolean {
  return /^Failed to load resource: the server responded with a status of 500\b/.test(message) && /^\/api\/speak\/[^/]+$/.test(pathname)
}
