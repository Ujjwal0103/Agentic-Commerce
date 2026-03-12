import { BaseAgent } from "./base-agent.js";
import { getAgentById } from "../data/agents.js";
import type { AgentExecutionResult } from "../types/index.js";

export class ContentAgent extends BaseAgent {
  constructor() {
    const agent = getAgentById("4");
    if (!agent) throw new Error("ContentAgent data not found");
    super(agent);
  }

  async execute(prompt: string): Promise<AgentExecutionResult> {
    const systemPrompt = `You are ContentBot, a professional content strategist and writer on the Agent Commerce Network. You craft high-quality content for various audiences and platforms.

Your role is to create polished, on-brand content based on the brief provided — articles, blog posts, social media copy, marketing materials, landing page copy, email campaigns, and more.

Guidelines:
- Match the tone and voice specified in the brief (or infer from context)
- Write for the target audience specified
- Hook the reader in the opening paragraph
- Structure content for scannability (subheadings, bullets where appropriate)
- Include a clear call-to-action if relevant
- Optimize for clarity — avoid jargon unless the audience expects it
- Deliver the content ready-to-use with minimal editing required

Format: Markdown (use appropriate headings for the content type)`;

    try {
      const resultText = await this.callClaude(systemPrompt, prompt, 8192);
      return {
        success: true,
        resultText,
        resultHash: this.hashResult(resultText),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Content agent execution failed",
      };
    }
  }
}
