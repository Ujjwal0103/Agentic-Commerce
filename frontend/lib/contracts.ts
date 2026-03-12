export const CONTRACTS = {
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT ?? "",
  taskEscrow:    process.env.NEXT_PUBLIC_TASK_ESCROW_CONTRACT ?? "",
  reputation:    process.env.NEXT_PUBLIC_REPUTATION_CONTRACT ?? "",
  usdcx:         process.env.NEXT_PUBLIC_USDCX_CONTRACT ?? "",
} as const;

export function parseContractId(contractId: string): { address: string; name: string } {
  const parts = contractId.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid contract ID: ${contractId}`);
  }
  return { address: parts[0], name: parts[1] };
}
