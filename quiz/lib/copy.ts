// Copies text from a click. navigator.clipboard exists only on https and localhost, so a
// phone on http://<LAN IP>/ falls back to a hidden textarea and execCommand("copy").
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the textarea copy.
    }
  }
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, text.length)
  try {
    return document.execCommand("copy")
  } catch {
    // A browser without execCommand throws; false tells the caller the copy failed, which it reports.
    return false
  } finally {
    area.remove()
  }
}
