import { test, expect, openVoice } from "./fixtures"

test.use({ navigationCutOff: true })

test("a new Agentic scene reaches the Voice Quiz and saves under that exam", async ({ page, baseURL }) => {
  const origin = { origin: baseURL! }
  try {
    expect((await page.request.post("/api/exam", { headers: origin, data: { exam: "agentic-architect" } })).ok()).toBe(true)
    const cleared = await page.request.post("/api/scores/reset", {
      headers: { ...origin, "x-quiz-exam": "agentic-architect" }, data: { confirm: true },
    })
    expect(cleared.ok()).toBe(true)
    const response = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })
    const body = await response.json() as { snapshot: { items: { id: string; section: number; stem: string }[] } }
    const index = body.snapshot.items.findIndex((item) => item.id === "enterprise-no-code-agent")
    const scene = body.snapshot.items[index]
    if (!scene) throw new Error("The new Agentic scene is missing from the real snapshot")
    expect(scene.section).toBe(1)

    await openVoice(page, () => page.evaluate(({ index, count }) => {
      let remaining = count - 1
      const original = Math.random
      Math.random = () => remaining > 0 ? (remaining-- === index ? 0 : 0.999999999) : original()
    }, { index, count: body.snapshot.items.length }))
    await expect(page.locator("main")).toContainText(scene.stem)
    const saved = page.waitForResponse((result) =>
      result.url().endsWith("/api/scores") && result.request().method() === "POST",
    )
    await page.getByRole("button", { name: /^A\./ }).click()
    expect((await saved).ok()).toBe(true)
    const after = await page.request.get("/api/snapshot", { headers: { "x-quiz-exam": "agentic-architect" } })
    expect(await after.json()).toMatchObject({
      ok: true, snapshot: { lines: expect.arrayContaining([expect.objectContaining({ mode: "round", asked: ["enterprise-no-code-agent"] })]) },
    })
  } finally {
    try {
      if (new URL(page.url()).pathname === "/voice") await page.goto("/progress")
      await page.waitForLoadState("networkidle")
    } finally {
      await page.request.post("/api/exam", { headers: origin, data: { exam: "generative-ai-leader" } })
    }
  }
})
