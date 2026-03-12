export type AgentSkill =
  | "web-research"
  | "summarization"
  | "data-analysis"
  | "content-writing"
  | "code-review";

export type TaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled";

export const TASK_STATUS_MAP: Record<number, TaskStatus> = {
  0: "pending",
  1: "processing",
  2: "completed",
  3: "disputed",
  4: "refunded",
  5: "cancelled",
};

export interface Agent {
  id: string;
  onChainId: number;
  name: string;
  slug: string;
  description: string;
  skills: AgentSkill[];
  priceUstx: number;
  priceDisplay: string;
  endpoint: string;
  active: boolean;
  avatarUrl: string;
}

export interface Task {
  id: string;
  onChainTaskId: number;
  agentId: string;
  clientAddress: string;
  prompt: string;
  promptHash: string;
  status: TaskStatus;
  paymentTxId: string;
  resultText?: string;
  resultHash?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStore = Map<string, Task>;

export interface PaymentRequiredBody {
  error: "payment_required";
  agentId: string;
  agentName: string;
  priceUstx: number;
  priceDisplay: string;
  escrowContract: string;
  instructions: string;
}

export interface CreateTaskBody {
  agentId: string;
  prompt: string;
  clientAddress: string;
  paymentTxId: string;
  onChainTaskId: number;
}

export interface AgentExecutionResult {
  success: boolean;
  resultText?: string;
  resultHash?: string;
  error?: string;
}
