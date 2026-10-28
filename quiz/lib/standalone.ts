// Whether the quiz runs as the installed home-screen app rather than in a browser tab.
// Browsers report display-mode standalone; iOS Safari's home-screen apps set navigator.standalone.
export function isStandalone(signals: { displayModeStandalone: boolean; iosStandalone: boolean | undefined }): boolean {
  return signals.displayModeStandalone || signals.iosStandalone === true
}
