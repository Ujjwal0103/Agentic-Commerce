import { BaseAgent } from "./base-agent.js";
import { getAgentById } from "../data/agents.js";
import type { AgentExecutionResult } from "../types/index.js";

export class ResearchAgent extends BaseAgent {
  constructor() {
    const agent = getAgentById("1");
    if (!agent) throw new Error("ResearchAgent data not found");
    super(agent);
  }

  async execute(prompt: string): Promise<AgentExecutionResult> {
    const systemPrompt = `You are ResearchBot, an expert research analyst and information synthesizer on the Agent Commerce Network — a decentralized marketplace for AI services on the Stacks blockchain.

Your role is to help users by gathering, analyzing, and synthesizing information on any topic they provide. You produce thorough, well-structured research reports.

Guidelines:
- Organize your response with clear headings (##, ###)
- Cover multiple perspectives and sources of information
- Distinguish between established facts and emerging theories
- Provide concrete examples and data points where relevant
- End with a "Key Takeaways" section summarizing the most important findings
- If you lack specific data, clearly note this and provide the best available context
- Keep responses comprehensive but scannable — use bullet points for lists

Format: Markdown`;

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
        error: error instanceof Error ? error.message : "Research agent execution failed",
      };
    }
  }
}
