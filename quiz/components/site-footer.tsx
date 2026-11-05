import { Fragment } from "react"
import { BuildStamp } from "@/components/build-stamp"
import { ThemeToggle } from "@/components/theme-toggle"
import { activePack } from "@/lib/pack"
import { BASE_PATH } from "@/lib/static-demo"
// flush drops the top margin, for a page whose last line should sit just above the footer.
export function SiteFooter({ flush = false }: { flush?: boolean } = {}) {
  const { meta } = activePack()
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
              href={meta.examPage}
              target="_blank"
              rel="noopener noreferrer"
            >
              OFFICIAL EXAM INFO
            </a>
            {meta.links.map((link) => (
              <Fragment key={link.href}>
                <span>|</span>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </Fragment>
            ))}
            <span>|</span>
            <a href={`${BASE_PATH}/about`}>ABOUT</a>
          </div>
          <p className="text-muted-foreground">
            Open-source. Not affiliated with, sponsored or endorsed by Google. The Google Cloud name and logo
            are trademarks of Google LLC. Content accuracy not guaranteed. Always verify with official
            documentation.
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
                by{" "}
                <a
                  href="https://www.ludovicobesana.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Ludovico Besana
                </a>
                .
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
