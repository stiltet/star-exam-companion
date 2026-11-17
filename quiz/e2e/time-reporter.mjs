// A node:test reporter that writes how long each test took, so the Pre-push checks can refuse a test that is too slow
// (agents/prepush-review/check-test-times.mts). Node writes what it yields to the reporter's destination:
//   node --test --test-reporter=spec --test-reporter=./quiz/e2e/time-reporter.mjs \
//     --test-reporter-destination=stdout --test-reporter-destination=temp/gate/unit.json
// The file holds { tests: [{ file, name, nesting, ms }], wallMs }. A test that has subtests counts all of them.
export default async function* timeReporter(source) {
  const tests = []
  let wallMs = 0
  for await (const event of source) {
    if (event.type === "test:pass" || event.type === "test:fail") {
      const { file, name, nesting, details } = event.data
      tests.push({ file: file ?? "", name, nesting: nesting ?? 0, ms: Math.round(details?.duration_ms ?? 0) })
    } else if (event.type === "test:summary") {
      wallMs = Math.round(event.data.duration_ms ?? 0)
    }
  }
  yield `${JSON.stringify({ tests, wallMs }, null, 2)}\n`
}
