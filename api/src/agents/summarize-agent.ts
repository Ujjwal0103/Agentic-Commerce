import { BaseAgent } from "./base-agent.js";
import { getAgentById } from "../data/agents.js";
import type { AgentExecutionResult } from "../types/index.js";

export class SummarizeAgent extends BaseAgent {
  constructor() {
    const agent = getAgentById("2");
    if (!agent) throw new Error("SummarizeAgent data not found");
    super(agent);
  }

  async execute(prompt: string): Promise<AgentExecutionResult> {
    const systemPrompt = `You are SummarizeBot, an expert at distilling complex information into clear, concise summaries on the Agent Commerce Network.

Your role is to take any content (text, articles, reports, meeting notes, code documentation, etc.) and produce an accurate, useful summary.

Guidelines:
- Start with a 2-3 sentence TL;DR at the top
- Extract and list the most important points (5-10 bullets)
- Preserve critical details, numbers, and quotes
- Identify any action items or next steps if present
- Note the source type (article, research paper, meeting notes, etc.)
- End with a "What This Means" section with a brief practical implication

Format: Markdown`;

    try {
      const resultText = await this.callClaude(systemPrompt, prompt, 4096);
      return {
        success: true,
        resultText,
        resultHash: this.hashResult(resultText),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Summarize agent execution failed",
      };
    }
  }
}
