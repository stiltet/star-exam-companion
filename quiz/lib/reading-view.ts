// The five courses of the learning path (https://www.skills.google/paths/1951), in its order.
export const COURSES = [
  { id: "1", template: "1268", title: "Gen AI: Beyond the Chatbot", folder: "C1_C-GENBTC-B_Gen AI_Beyond the Chatbot" },
  { id: "2", template: "1265", title: "Gen AI: Unlock Foundational Concepts", folder: "C2_C-GENDEC-B_Gen AI_Unlock Foundational Concepts" },
  { id: "3", template: "1261", title: "Gen AI: Navigate the Landscape", folder: "C3_C-GENSTACK-B_GenAI_Navigate the Landscape" },
  { id: "4", template: "1266", title: "Gen AI Apps: Transform Your Work", folder: "C4_C-GENTYW-B_Transform Your Work with Gen AI Apps" },
  { id: "5", template: "1267", title: "Gen AI Agents: Transform Your Organization", folder: "C5_C-TOGENAI-B_GenAIAgentsTransformYourOrganization" },
] as const

export type Course = (typeof COURSES)[number]

export type PageSummary = { id: string; title: string }

export type Paragraph = { text: string; heading: boolean; lead?: string; bullet?: true }

export type Reading = { title: string; paragraphs: Paragraph[]; review: boolean; reviewAt: number[]; videoAt: number[] }

// Where the review button sits and the voice stops: before the paragraph the review stood before
// on Google. A review at the very start or end keeps the button at the end, with no stop.
export function reviewStop(review: boolean, reviewAt: number | null, count: number): number | null {
  return review && reviewAt !== null && reviewAt > 0 && reviewAt < count ? reviewAt : null
}