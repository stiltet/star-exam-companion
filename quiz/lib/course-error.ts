// What the page says when a course's text could not be read. The detail is shown beside it for whoever looks into it.
//
// A public course comes from Google, so the cause is there and trying again later is the way on. A private course is read
// from files on this server: one damaged saved file needs removing, while a problem with the folder itself (a path that is
// not allowed) needs the setting fixed, and removing a saved reading would only lose it.
const RECORD_PROBLEM = /Private reading record .+ (?:is not valid JSON|is invalid|is too large)\./

export function courseErrorMessage(detail: string, local: boolean): string {
  if (!local) return "Google did not send the course text just now. Try again in a minute."
  if (RECORD_PROBLEM.test(detail)) {
    return "This server could not read one of the private copies of this course. A saved file may be damaged: remove it from the private-reading folder (see the README), then try again."
  }
  return "This server could not use its private-reading folder. QUIZ_PRIVATE_DIR must be a folder outside the project (see the README). Your saved readings are not affected."
}
