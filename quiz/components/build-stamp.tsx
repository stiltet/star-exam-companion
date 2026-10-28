export function BuildStamp() {
  return <>Updated: {process.env.NEXT_PUBLIC_QUIZ_BUILT_AT} ({process.env.NEXT_PUBLIC_QUIZ_COMMIT})</>
}
