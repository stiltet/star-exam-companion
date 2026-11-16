// What the page says when a course's text could not be read. The detail is shown beside it for whoever looks into it.
//
// A public course comes from Google, so the cause is there and trying again later is the way on. A private course is read
// from files on this server, and its loader says which kind of problem it was: a saved file (or a link in the course folder)
// that has to be removed, or the folder itself, such as a setting that is not allowed, where removing a saved reading would
// only lose it. The loader names the kind, so this text never has to guess from a message.
export type CourseProblem = "record" | "folder"

export function courseErrorMessage(problem: CourseProblem | undefined): string {
  if (problem === undefined) return "Google did not send the course text just now. Try again in a minute."
  if (problem === "record") {
    return "This server could not read one of the private copies of this course. A saved file may be damaged: remove it from the private-reading folder (see the README), then try again."
  }
  return "This server could not use its private-reading folder. QUIZ_PRIVATE_DIR must be a folder outside the project (see the README). Your saved readings are not affected."
}
