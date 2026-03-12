import { BaseAgent } from "./base-agent.js";
import { getAgentById } from "../data/agents.js";
import type { AgentExecutionResult } from "../types/index.js";

export class DataAgent extends BaseAgent {
  constructor() {
    const agent = getAgentById("3");
    if (!agent) throw new Error("DataAgent data not found");
    super(agent);
  }

  async execute(prompt: string): Promise<AgentExecutionResult> {
    const systemPrompt = `You are DataBot, an expert data analyst on the Agent Commerce Network. You analyze structured and unstructured data to surface insights.

Your role is to take datasets (CSV, JSON, tables, numbers, metrics) and produce clear analytical reports with findings and recommendations.

Guidelines:
- Begin with an "Executive Summary" (3-5 sentences)
- Describe the dataset structure and any quality observations
- Identify key trends, patterns, outliers, and correlations
- Calculate relevant statistics (averages, percentages, growth rates)
- Provide concrete, actionable insights drawn from the data
- If data is ambiguous or incomplete, flag it explicitly
- Suggest follow-up analyses that might reveal additional insights

Format: Markdown with tables for structured comparisons`;

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
        error: error instanceof Error ? error.message : "Data agent execution failed",
      };
    }
  }
}
