// True only in the build published on GitHub Pages (scripts/build-pages.sh sets it). That build is
// plain static files with no server behind it, so every place that would call the server checks
// this first and does nothing. The local app never sets it, so it behaves exactly as before.
// The literal process.env name is needed: Next replaces it with the value when it builds.
export const STATIC_DEMO = process.env.NEXT_PUBLIC_QUIZ_STATIC === "1"

// Where the demo's setup instructions live.
export const SETUP_URL = "https://github.com/stiltet/star-exam-companion#full-local-setup"
