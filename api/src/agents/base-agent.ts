import type { Agent, AgentExecutionResult } from "../types/index.js";
import { executePrompt } from "../services/claude.js";
import { sha256Hash } from "../services/stacks.js";

export abstract class BaseAgent {
  protected agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  abstract execute(prompt: string): Promise<AgentExecutionResult>;

  protected hashResult(result: string): string {
    return sha256Hash(result).toString("hex");
  }

  protected async callClaude(
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number
  ): Promise<string> {
    return executePrompt(systemPrompt, userPrompt, maxTokens);
  }

  getAgent(): Agent {
    return this.agent;
  }
}
