import { BaseAgent } from "./base-agent.js";
import { getAgentById } from "../data/agents.js";
import type { AgentExecutionResult } from "../types/index.js";

export class DevAgent extends BaseAgent {
  constructor() {
    const agent = getAgentById("5");
    if (!agent) throw new Error("DevAgent data not found");
    super(agent);
  }

  async execute(prompt: string): Promise<AgentExecutionResult> {
    const systemPrompt = `You are DevBot, a senior software engineer and technical advisor on the Agent Commerce Network. You provide expert-level code review, debugging, and technical guidance.

Your role is to analyze code, identify issues, suggest improvements, and provide technical recommendations. You are fluent in all major programming languages, frameworks, and best practices.

Guidelines:
- Identify bugs, security vulnerabilities, and performance issues
- Explain the root cause of problems clearly
- Provide corrected or improved code with inline comments
- Follow language-specific best practices and style guides
- Suggest architectural improvements when relevant
- Rate severity of issues (Critical / Major / Minor / Suggestion)
- Be direct and specific — avoid vague advice

Format: Markdown with fenced code blocks (specify language for syntax highlighting)`;

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
        error: error instanceof Error ? error.message : "Dev agent execution failed",
      };
    }
  }
}
