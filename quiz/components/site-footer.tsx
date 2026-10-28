import { BuildStamp } from "@/components/build-stamp"
import { ThemeToggle } from "@/components/theme-toggle"
// flush drops the top margin, for a page whose last line should sit just above the footer.
export function SiteFooter({ flush = false }: { flush?: boolean } = {}) {
  return (
    <footer className={`border-t-2 border-foreground ${flush ? "" : "sm:mt-16"}`}>
      {/* footer-bottom: in the installed app, room to keep the last line clear of the floating Back button. */}
      <div className="footer-bottom max-w-4xl mx-auto px-4 pt-8 pb-8">
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <a href="https://github.com/stiltet/star-exam-companion" target="_blank" rel="noopener noreferrer">
              GITHUB
            </a>
            <span>|</span>
            <a href="https://github.com/stiltet/star-exam-companion/issues" target="_blank" rel="noopener noreferrer">
              REPORT AN ISSUE
            </a>
            <span>|</span>
            <a
              href="https://cloud.google.com/learn/certification/generative-ai-leader"
              target="_blank"
              rel="noopener noreferrer"
            >
              OFFICIAL EXAM INFO
            </a>
            <span>|</span>
            <a href="https://www.cloudskillsboost.google/paths/118" target="_blank" rel="noopener noreferrer">
              INTRO TO GENAI SKILLS BOOST PATH
            </a>
            <span>|</span>
            <a href="https://www.skills.google/paths/1951" target="_blank" rel="noopener noreferrer">
              GENERATIVE AI LEADER PATH
            </a>
            <span>|</span>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScNn5oUIFeMQjtsHilQsJPxDsnP-0DbhDVsIXaBeCmPj-dgYw/formResponse"
              target="_blank"
              rel="noopener noreferrer"
            >
              SAMPLE QUESTIONS
            </a>
            <span>|</span>
            <a href="/about">ABOUT</a>
          </div>
          <p className="text-muted-foreground">
            Open-source. Not affiliated with, sponsored or endorsed by Google. Google Cloud is a trademark of
            Google LLC. Content accuracy not guaranteed. Always verify with official documentation.
          </p>
          {/* On desktop the credit and build stamp sit level with the theme button, right-aligned. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <ThemeToggle />
            </div>
            <div className="flex flex-col gap-4 sm:gap-1 sm:text-right">
              <p className="text-muted-foreground">
                Made with ♥ by{" "}
                <a
                  href="https://github.com/stiltet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Stellan Lindell
                </a>
                . Built on{" "}
                <a
                  href="https://github.com/ludovicobesana/gail-exam-preparation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  gail-exam-preparation
                </a>{" "}
                by Ludovico Besana.
              </p>
              <p className="text-muted-foreground">
                <BuildStamp />
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
