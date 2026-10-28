import assert from "node:assert/strict"
import test from "node:test"
import { connectionText, forceUpdate, SNAPSHOT_AT_KEY } from "./connection.ts"
import { OUTBOX_KEY } from "./outbox.ts"
import { SNAPSHOT_KEY, type Snapshot } from "./snapshot.ts"

function memory(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data }
}

const fresh: Snapshot = { items: [], terms: [], namesChecked: "2026-10-08", sections: [], lines: [], skippedLines: 0, voice: {} }

test("the connection icon names the source for screen readers, with an offline copy's date", () => {
  assert.equal(connectionText("mac", null), "Live from the Mac")
  assert.match(connectionText("device", "2026-10-07T12:16:00.000Z"), /^Offline: copy from 7 Oct$/)
  assert.equal(connectionText("device", null), "Offline: copy from an unknown date")
  assert.equal(connectionText("none", null), "Offline: no copy on this device yet")
})

test("update now changes nothing when the Mac cannot be reached", async () => {
  const store = memory({ [SNAPSHOT_KEY]: "old", [OUTBOX_KEY]: "[1]" })
  let refreshed = false
  let reloaded = false
  const result = await forceUpdate({
    fetchSnapshot: async () => null,
    store,
    refreshWorker: async () => void (refreshed = true),
    reload: () => void (reloaded = true),
    now: () => new Date("2026-10-08T12:00:00Z"),
  })
  assert.equal(result, "unreachable")
  assert.equal(store.data.get(SNAPSHOT_KEY), "old")
  assert.equal(store.data.get(OUTBOX_KEY), "[1]")
  assert.equal(refreshed, false)
  assert.equal(reloaded, false)
})

test("update now replaces the copy only after a fresh one arrives, keeps unsent answers, then refreshes the worker and reloads", async () => {
  const store = memory({ [SNAPSHOT_KEY]: "old", [OUTBOX_KEY]: "[1]" })
  const order: string[] = []
  const result = await forceUpdate({
    fetchSnapshot: async () => (order.push("fetch"), fresh),
    store,
    refreshWorker: async () => void order.push("clear"),
    reload: () => void order.push("reload"),
    now: () => new Date("2026-10-08T12:00:00Z"),
  })
  assert.equal(result, "updated")
  assert.deepEqual(order, ["fetch", "clear", "reload"])
  assert.equal(JSON.parse(store.data.get(SNAPSHOT_KEY) ?? "null").namesChecked, "2026-10-08")
  assert.equal(store.data.get(SNAPSHOT_AT_KEY), "2026-10-08T12:00:00.000Z")
  assert.equal(store.data.get(OUTBOX_KEY), "[1]")
})

test("update now still reloads with the fresh copy when the worker cannot be refreshed", async () => {
  const store = memory({ [SNAPSHOT_KEY]: "old" })
  let reloaded = false
  const result = await forceUpdate({
    fetchSnapshot: async () => fresh,
    store,
    refreshWorker: async () => {
      throw new Error("sw.js unreachable")
    },
    reload: () => void (reloaded = true),
    now: () => new Date("2026-10-08T12:00:00Z"),
  })
  assert.equal(result, "updated")
  assert.equal(reloaded, true)
  assert.equal(JSON.parse(store.data.get(SNAPSHOT_KEY) ?? "null").namesChecked, "2026-10-08")
})
