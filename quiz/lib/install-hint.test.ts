import assert from "node:assert/strict"
import test from "node:test"
import { DISMISS_DAYS, SHOW_AFTER_MS, androidCopy, detectPlatform, shouldOffer, showDelay, type InstallState } from "./install-hint.ts"

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1"
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0"
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"
const MAC = IPAD
const ANDROID_INSTAGRAM = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 330.0 Android"

test("platforms are told apart", () => {
  assert.equal(detectPlatform(IPHONE, 5), "ios-safari")
  assert.equal(detectPlatform(IPAD, 5), "ios-safari")
  assert.equal(detectPlatform(MAC, 0), "other")
  assert.equal(detectPlatform(IPHONE_CHROME, 5), "ios-other")
  assert.equal(detectPlatform(IPHONE_INSTAGRAM, 5), "other")
  assert.equal(detectPlatform(ANDROID, 5), "android")
  assert.equal(detectPlatform(ANDROID_INSTAGRAM, 5), "other")
  assert.equal(detectPlatform("Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0", 0), "other")
})

const base: InstallState = { platform: "android", standalone: false, installed: false, dismissedAt: null, now: 1_000_000_000_000 }

test("the hint is offered on a phone browser", () => {
  assert.equal(shouldOffer(base), true)
  assert.equal(shouldOffer({ ...base, platform: "ios-safari" }), true)
  assert.equal(shouldOffer({ ...base, platform: "ios-other" }), true)
})

test("the hint is not offered on desktop, in the installed app or once installed", () => {
  assert.equal(shouldOffer({ ...base, platform: "other" }), false)
  assert.equal(shouldOffer({ ...base, platform: detectPlatform(IPHONE_INSTAGRAM, 5) }), false)
  assert.equal(shouldOffer({ ...base, standalone: true }), false)
  assert.equal(shouldOffer({ ...base, installed: true }), false)
})

test("a dismissal hides the hint for 30 days", () => {
  const day = 24 * 60 * 60 * 1000
  assert.equal(shouldOffer({ ...base, dismissedAt: base.now - (DISMISS_DAYS - 1) * day }), false)
  assert.equal(shouldOffer({ ...base, dismissedAt: base.now - DISMISS_DAYS * day }), true)
})

test("the hint waits on a first visit and shows at once on the second", () => {
  assert.equal(showDelay(1), SHOW_AFTER_MS)
  assert.equal(showDelay(2), 0)
})

test("Android is told the menu steps when the browser gives no install prompt", () => {
  assert.match(androidCopy(false), /browser menu/)
  assert.doesNotMatch(androidCopy(true), /menu/)
  assert.equal(shouldOffer({ ...base, platform: "android" }), true)
})
