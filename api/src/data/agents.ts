import type { Agent } from "../types/index.js";

export const AGENTS: Agent[] = [
  {
    id: "1",
    onChainId: 1,
    name: "ResearchBot",
    slug: "research-bot",
    description:
      "Web research and information synthesis. Provide any topic or question and ResearchBot will gather, verify, and synthesize comprehensive, well-structured information.",
    skills: ["web-research"],
    priceUstx: 2_000_000,
    priceDisplay: "2.00 USDCx",
    endpoint: "/internal/agents/research-bot",
    active: true,
    avatarUrl: "/avatars/research-bot.svg",
  },
  {
    id: "2",
    onChainId: 2,
    name: "SummarizeBot",
    slug: "summarize-bot",
    description:
      "Document, text, and URL summarization. Paste any content and SummarizeBot will produce concise, accurate summaries with key takeaways and action items.",
    skills: ["summarization"],
    priceUstx: 1_000_000,
    priceDisplay: "1.00 USDCx",
    endpoint: "/internal/agents/summarize-bot",
    active: true,
    avatarUrl: "/avatars/summarize-bot.svg",
  },
  {
    id: "3",
    onChainId: 3,
    name: "DataBot",
    slug: "data-bot",
    description:
      "Data analysis and insights. Provide CSV data, JSON, or numerical datasets and DataBot will identify patterns, anomalies, trends, and actionable insights.",
    skills: ["data-analysis"],
    priceUstx: 3_000_000,
    priceDisplay: "3.00 USDCx",
    endpoint: "/internal/agents/data-bot",
    active: true,
    avatarUrl: "/avatars/data-bot.svg",
  },
  {
    id: "4",
    onChainId: 4,
    name: "ContentBot",
    slug: "content-bot",
    description:
      "Article, copy, and creative writing. Brief ContentBot on your audience, tone, and goals to receive polished, on-brand content ready to publish.",
    skills: ["content-writing"],
    priceUstx: 2_500_000,
    priceDisplay: "2.50 USDCx",
    endpoint: "/internal/agents/content-bot",
    active: true,
    avatarUrl: "/avatars/content-bot.svg",
  },
  {
    id: "5",
    onChainId: 5,
    name: "DevBot",
    slug: "dev-bot",
    description:
      "Code review, debugging, and technical advice. Share code snippets or describe technical problems for expert-level analysis, refactoring suggestions, and best-practice recommendations.",
    skills: ["code-review"],
    priceUstx: 3_500_000,
    priceDisplay: "3.50 USDCx",
    endpoint: "/internal/agents/dev-bot",
    active: true,
    avatarUrl: "/avatars/dev-bot.svg",
  },
];

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function getAgentBySlug(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}

export function getAgentByOnChainId(onChainId: number): Agent | undefined {
  return AGENTS.find((a) => a.onChainId === onChainId);
}
