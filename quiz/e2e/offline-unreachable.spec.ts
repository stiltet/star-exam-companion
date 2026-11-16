import { test, expect, readyOffline, UNREACHABLE_PATH } from "./fixtures"

// Rule 19, with the Mac unreachable: a page never opened on this device is never a dead end, and one that was opened still opens.
test.describe("with the Mac unreachable", () => {
  test.use({ offlineNetwork: true })

  test("a page that is not on the device offers Try again and Go home, and Go home opens", async ({ context, page }) => {
    await page.goto("/")
    await readyOffline(page)
    await page.waitForLoadState("networkidle")
    await context.setOffline(true)
    const response = await page.goto(UNREACHABLE_PATH)
    expect(response?.status()).toBe(503)
    await expect(page.getByText(/The Mac cannot be reached, and this page is not on this device yet/)).toBeVisible()
    await expect(page.getByRole("button", { name: "TRY AGAIN" })).toBeVisible()
    // Trying again while the Mac is still unreachable gives the same page, not a blank one.
    // The page really loads again: the load event fires after the tap.
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "TRY AGAIN" }).click()])
    await expect(page.getByText(/The Mac cannot be reached, and this page is not on this device yet/)).toBeVisible()
    await page.getByRole("link", { name: "GO HOME" }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByRole("heading", { name: "DESCRIPTION" })).toBeVisible()
  })
})
