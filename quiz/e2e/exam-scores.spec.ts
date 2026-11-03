import { test, expect, answerPractice } from "./fixtures"

// Each exam keeps its own scores file (scratch ones here, QUIZ_SCORES_DIR in server.mjs), so an answer in one exam
// is never in the other's snapshot, and switching back finds the first exam's answer where it was.
test("scores are kept per exam: an answer in one exam is not in the other's snapshot", async ({ page, baseURL }) => {
  const origin = { origin: baseURL! }
  const snapshot = async (exam: string) => {
    const response = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": exam } })
    expect(response.status(), `snapshot of ${exam}`).toBe(200)
    return ((await response.json()) as { snapshot: { lines: { asked: string[] }[] } }).snapshot.lines
  }
  try {
    // The scratch scores last for the whole run and the fixture clears only the exam being served, so clear the second exam's too.
    expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
    const cleared = await page.request.post("/api/scores/reset", { headers: { ...origin, "x-quiz-exam": "agentic-architect" }, data: { confirm: true } })
    expect(cleared.ok()).toBe(true)
    expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })).ok()).toBe(true)

    // One answer in the first exam, through the page.
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/scores") && response.request().method() === "POST")
    await answerPractice(page)
    expect((await saved).ok()).toBe(true)
    const first = await snapshot("generative-ai-leader")
    expect(first.length).toBeGreaterThan(0)

    // Switch to the second exam: it starts with none of them.
    expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
    expect(await snapshot("agentic-architect")).toEqual([])

    // Answer there, as a page of that exam sends it.
    const answer = { id: crypto.randomUUID(), at: new Date().toISOString(), mode: "practice", asked: ["aq1"], missed: [] }
    const stored = await page.request.post("/api/scores", { headers: { ...origin, "x-quiz-exam": "agentic-architect" }, data: { answers: [answer] } })
    expect(await stored.json()).toMatchObject({ ok: true, stored: [answer.id] })
    expect((await snapshot("agentic-architect")).map((line) => line.asked)).toEqual([["aq1"]])

    // Back to the first exam: its answer is still there and the second exam's is not.
    expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })).ok()).toBe(true)
    const again = await snapshot("generative-ai-leader")
    expect(again.length).toBe(first.length)
    expect(again.some((line) => line.asked.includes("aq1"))).toBe(false)
  } finally {
    await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
  }
})
