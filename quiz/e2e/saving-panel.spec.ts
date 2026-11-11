import { test, expect } from "./fixtures"

// The Saving panel opens from the status icon in the header, and no longer sits on Progress.
const icon = (page: import("@playwright/test").Page) => page.locator("header button[aria-controls='saving-panel']")

test("on a phone the status icon opens Saving under the header, and the menu and Saving close each other", async ({ page }) => {
  await page.goto("/")
  await expect(icon(page)).toHaveAttribute("aria-expanded", "false")
  await icon(page).click()
  const panel = page.locator("#saving-panel")
  await expect(panel).toBeVisible()
  await expect(icon(page)).toHaveAttribute("aria-expanded", "true")
  await expect(panel.getByText("Waiting to send")).toBeVisible()
  await expect(panel.getByRole("button", { name: "Update now" })).toBeVisible()
  // Opening the menu shuts Saving.
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator("#site-menu")).toBeVisible()
  // And Saving shuts the menu.
  await icon(page).click()
  await expect(page.locator("#site-menu")).toHaveCount(0)
  await expect(panel).toBeVisible()
  // Escape shuts it and focus returns to the icon.
  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await expect(icon(page)).toBeFocused()
  // A tap outside shuts it too.
  await icon(page).click()
  await expect(panel).toBeVisible()
  await page.mouse.click(5, 830)
  await expect(panel).toHaveCount(0)
})

test("a wider screen opens Saving as a dialog", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 })
  await page.goto("/")
  await icon(page).click()
  const dialog = page.getByRole("dialog", { name: "Status" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("Waiting to send")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})

test("Progress no longer shows Saving", async ({ page }) => {
  await page.goto("/progress")
  await expect(page.getByRole("heading", { name: "VOICE QUIZ" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "STATUS" })).toHaveCount(0)
})
