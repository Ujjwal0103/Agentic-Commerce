import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { x402PaymentMiddleware } from "../middleware/x402.js";
import { getAgentById } from "../data/agents.js";
import { markTaskProcessing, completeTask, sha256Hash } from "../services/stacks.js";
import type { Task, TaskStore, CreateTaskBody } from "../types/index.js";

// In-memory task store.
// Replace with PostgreSQL or Redis for production deployments.
export const taskStore: TaskStore = new Map<string, Task>();

const router = Router();

// POST /api/tasks
// x402PaymentMiddleware verifies on-chain payment before this handler runs.
// Body: CreateTaskBody
// Returns: { taskId: string, task: Task }
router.post(
  "/",
  x402PaymentMiddleware as (req: Request, res: Response, next: () => void) => Promise<void>,
  (req: Request, res: Response): void => {
    const body = req.body as CreateTaskBody;
    const promptHash = sha256Hash(body.prompt).toString("hex");
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      onChainTaskId: body.onChainTaskId,
      agentId: body.agentId,
      clientAddress: body.clientAddress,
      prompt: body.prompt,
      promptHash,
      status: "pending",
      paymentTxId: body.paymentTxId,
      createdAt: now,
      updatedAt: now,
    };

    taskStore.set(taskId, task);
    res.status(201).json({ taskId, task });
  }
);

// GET /api/tasks/:id
// Returns current task state (polls for result).
router.get("/:id", (req: Request, res: Response): void => {
  const task = taskStore.get(req.params.id ?? "");
  if (!task) {
    res.status(404).json({ error: "task_not_found", id: req.params.id });
    return;
  }
  res.json({ task });
});

// POST /api/tasks/:id/execute
// Triggers agent execution. Responds 202 immediately; agent runs async.
// Frontend polls GET /api/tasks/:id for the result.
router.post("/:id/execute", async (req: Request, res: Response): Promise<void> => {
  const task = taskStore.get(req.params.id ?? "");

  if (!task) {
    res.status(404).json({ error: "task_not_found", id: req.params.id });
    return;
  }

  if (task.status !== "pending") {
    res.status(409).json({ error: "task_not_pending", currentStatus: task.status });
    return;
  }

  const agent = getAgentById(task.agentId);
  if (!agent) {
    res.status(404).json({ error: "agent_not_found", agentId: task.agentId });
    return;
  }

  // Update status to processing immediately
  task.status = "processing";
  task.updatedAt = new Date().toISOString();

  // Respond 202 so the client can start polling
  res.status(202).json({ message: "execution_started", taskId: task.id });

  // Mark processing on-chain (fire and forget — non-blocking)
  markTaskProcessing(task.onChainTaskId).catch((err: unknown) => {
    console.error(`[tasks] mark-processing failed for task ${task.id}:`, err);
  });

  // Execute the agent asynchronously
  runAgentAsync(task, agent.slug);
});

async function runAgentAsync(
  task: Task,
  agentSlug: string
): Promise<void> {
  try {
    const agentInstance = await importAgentBySlug(agentSlug);
    const result = await agentInstance.execute(task.prompt);

    if (result.success && result.resultText) {
      task.status = "completed";
      task.resultText = result.resultText;
      task.resultHash = result.resultHash;
      task.updatedAt = new Date().toISOString();

      // Record completion on-chain
      if (result.resultHash) {
        completeTask(task.onChainTaskId, result.resultHash).catch((err: unknown) => {
          console.error(`[tasks] complete-task on-chain failed for task ${task.id}:`, err);
        });
      }
    } else {
      task.status = "disputed";
      task.error = result.error ?? "Agent execution failed";
      task.updatedAt = new Date().toISOString();
    }
  } catch (err: unknown) {
    task.status = "disputed";
    task.error = err instanceof Error ? err.message : "Unknown execution error";
    task.updatedAt = new Date().toISOString();
    console.error(`[tasks] Agent execution error for task ${task.id}:`, err);
  }
}

async function importAgentBySlug(slug: string): Promise<{
  execute: (prompt: string) => Promise<{
    success: boolean;
    resultText?: string;
    resultHash?: string;
    error?: string;
  }>;
}> {
  switch (slug) {
    case "research-bot": {
      const { ResearchAgent } = await import("../agents/research-agent.js");
      return new ResearchAgent();
    }
    case "summarize-bot": {
      const { SummarizeAgent } = await import("../agents/summarize-agent.js");
      return new SummarizeAgent();
    }
    case "data-bot": {
      const { DataAgent } = await import("../agents/data-agent.js");
      return new DataAgent();
    }
    case "content-bot": {
      const { ContentAgent } = await import("../agents/content-agent.js");
      return new ContentAgent();
    }
    case "dev-bot": {
      const { DevAgent } = await import("../agents/dev-agent.js");
      return new DevAgent();
    }
    default:
      throw new Error(`Unknown agent slug: ${slug}`);
  }
}

export default router;
