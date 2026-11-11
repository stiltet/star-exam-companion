import { test, expect } from "./fixtures"

// Previous and Next lesson, and Previous and Next course, at the top and the bottom of each page.

test("a lesson has Previous and Next at the top and the bottom, and the ends step out to the course", async ({ page }) => {
  await page.goto("/read/1/e2e-first")
  const first = page.getByRole("navigation", { name: "Previous and next lesson" })
  await expect(first).toHaveCount(2)
  // The first lesson's Previous is its course's list of lessons; its Next is the second lesson.
  for (const nav of await first.all()) {
    await expect(nav.getByRole("link", { name: /Previous lesson/ })).toHaveAttribute("href", "/read/1")
    await expect(nav.getByRole("link", { name: /Next lesson: Test reading two/ })).toHaveAttribute("href", "/read/1/e2e-second")
  }
  await first.first().getByRole("link", { name: /Next lesson/ }).click()
  await expect(page).toHaveURL(/\/read\/1\/e2e-second$/)
  const second = page.getByRole("navigation", { name: "Previous and next lesson" })
  await expect(second).toHaveCount(2)
  await expect(second.last().getByRole("link", { name: /Previous lesson: Test reading one/ })).toHaveAttribute("href", "/read/1/e2e-first")
})

test("the course list has Previous and Next course at the top and the bottom", async ({ page }) => {
  await page.goto("/read/2")
  const nav = page.getByRole("navigation", { name: "Previous and next course" })
  await expect(nav).toHaveCount(2)
  await expect(nav.first().getByRole("link", { name: /Previous course: Course 1/ })).toHaveAttribute("href", "/read/1")
  await expect(nav.last().getByRole("link", { name: /Next course: Course 3/ })).toHaveAttribute("href", "/read/3")
  // The first course has no Previous. Let the links' prefetches finish first, or WebKit logs them as cancelled.
  await page.waitForLoadState("networkidle")
  await page.goto("/read/1")
  await expect(page.getByRole("link", { name: /Previous course/ })).toHaveCount(0)
})
