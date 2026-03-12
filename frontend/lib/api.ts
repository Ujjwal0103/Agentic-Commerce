const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ---- Types (mirrors API types without importing from api/) ----

export interface Agent {
  id: string;
  onChainId: number;
  name: string;
  slug: string;
  description: string;
  priceUstx: number;
  priceDisplay: string;
  active: boolean;
  avatarUrl: string;
  skills: string[];
}

export interface Task {
  id: string;
  onChainTaskId: number;
  agentId: string;
  clientAddress: string;
  prompt: string;
  status: "pending" | "processing" | "completed" | "disputed" | "refunded" | "cancelled";
  paymentTxId: string;
  resultText?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface PaymentRequiredBody {
  error: "payment_required";
  agentId: string;
  agentName: string;
  priceUstx: number;
  priceDisplay: string;
  escrowContract: string;
  instructions: string;
}

// ---- API calls ----

export async function fetchAgents(onlyActive = false): Promise<{ agents: Agent[]; total: number }> {
  const url = `${API_BASE}/api/agents${onlyActive ? "?active=true" : ""}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.statusText}`);
  return res.json();
}

export async function fetchAgent(id: string): Promise<{ agent: Agent }> {
  const res = await fetch(`${API_BASE}/api/agents/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch agent: ${res.statusText}`);
  return res.json();
}

export async function createTask(body: {
  agentId: string;
  prompt: string;
  clientAddress: string;
  paymentTxId: string;
  onChainTaskId: number;
}): Promise<
  | { taskId: string; task: Task; requiresPayment?: false }
  | { requiresPayment: true; paymentInfo: PaymentRequiredBody }
> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    const paymentInfo = await res.json() as PaymentRequiredBody;
    return { requiresPayment: true, paymentInfo };
  }
  if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
  return res.json();
}

export async function fetchTask(id: string): Promise<{ task: Task }> {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch task: ${res.statusText}`);
  return res.json();
}

export async function executeTask(id: string): Promise<{ message: string; taskId: string }> {
  const res = await fetch(`${API_BASE}/api/tasks/${id}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to execute task: ${res.statusText}`);
  return res.json();
}
