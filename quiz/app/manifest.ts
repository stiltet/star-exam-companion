import type { MetadataRoute } from "next"
import { BASE_PATH } from "@/lib/static-demo"

// The online demo's export needs this built as a file; the local app serves the same thing.
export const dynamic = "force-static"

// What Android needs to offer the install. start_url and scope carry the demo's sub-path.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Star Exam Companion",
    short_name: "Star Exam",
    description: "Open-source exam preparation for the Google Cloud Generative AI Leader certification.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/favicon.png`, sizes: "512x512", type: "image/png" },
    ],
  }
}
