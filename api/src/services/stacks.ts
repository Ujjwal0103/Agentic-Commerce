import {
  makeContractCall,
  broadcastTransaction,
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
  bufferCV,
  boolCV,
  contractPrincipalCV,
  type StacksNetwork,
} from "@stacks/transactions";
import { StacksTestnet, StacksMainnet, StacksDevnet } from "@stacks/network";
import crypto from "node:crypto";

// ---- Network ----

export function getStacksNetwork(): StacksNetwork {
  const net = process.env.STACKS_NETWORK ?? "devnet";
  if (net === "mainnet") return new StacksMainnet();
  if (net === "testnet") return new StacksTestnet();
  return new StacksDevnet();
}

export function getApiBaseUrl(): string {
  return process.env.STACKS_API_URL ?? "http://localhost:3999";
}

// ---- Utilities ----

export function sha256Hash(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

function parseContractId(contractId: string): { address: string; name: string } {
  const parts = contractId.split(".");
  if (parts.length !== 2) throw new Error(`Invalid contract ID: ${contractId}`);
  return { address: parts[0]!, name: parts[1]! };
}

function getHotWalletKey(): string {
  // In production, derive the private key from the mnemonic.
  // For devnet, the deployer private key is well-known (from Devnet.toml).
  // Set HOT_WALLET_PRIVATE_KEY in .env to override.
  const key = process.env.HOT_WALLET_PRIVATE_KEY;
  if (!key) {
    throw new Error("HOT_WALLET_PRIVATE_KEY not set in environment");
  }
  return key;
}

// ---- Transaction Verification ----

/**
 * Fetches a Stacks transaction and verifies it is a successful create-task call
 * on the escrow contract with the expected arguments.
 *
 * Returns { verified: true, onChainTaskId } on success.
 * Throws on network error; returns { verified: false } on mismatch.
 */
export async function verifyCreateTaskTx(
  txId: string,
  expectedAgentId: number,
  expectedClientAddress: string,
  expectedAmountUstx: number
): Promise<{ verified: boolean; onChainTaskId: number }> {
  const apiUrl = getApiBaseUrl();
  const cleanTxId = txId.startsWith("0x") ? txId : `0x${txId}`;

  const resp = await fetch(`${apiUrl}/extended/v1/tx/${cleanTxId}`);
  if (!resp.ok) {
    return { verified: false, onChainTaskId: 0 };
  }

  const tx = (await resp.json()) as {
    tx_status: string;
    tx_type: string;
    sender_address: string;
    contract_call?: {
      contract_id: string;
      function_name: string;
      function_args: Array<{ type: string; repr: string }>;
    };
    tx_result?: { repr: string };
  };

  if (tx.tx_status !== "success") return { verified: false, onChainTaskId: 0 };
  if (tx.tx_type !== "contract_call") return { verified: false, onChainTaskId: 0 };

  const escrowContract = process.env.TASK_ESCROW_CONTRACT ?? "";
  if (tx.contract_call?.contract_id !== escrowContract) return { verified: false, onChainTaskId: 0 };
  if (tx.contract_call?.function_name !== "create-task") return { verified: false, onChainTaskId: 0 };
  if (tx.sender_address !== expectedClientAddress) return { verified: false, onChainTaskId: 0 };

  // Verify agent-id argument (first arg)
  const agentArg = tx.contract_call.function_args[0];
  if (!agentArg || agentArg.repr !== `u${expectedAgentId}`) return { verified: false, onChainTaskId: 0 };

  // Verify amount argument (second arg)
  const amountArg = tx.contract_call.function_args[1];
  if (!amountArg || amountArg.repr !== `u${expectedAmountUstx}`) return { verified: false, onChainTaskId: 0 };

  // Extract task ID from result: "(ok u3)" -> 3
  const resultRepr = tx.tx_result?.repr ?? "";
  const match = resultRepr.match(/\(ok u(\d+)\)/);
  if (!match || !match[1]) return { verified: false, onChainTaskId: 0 };

  return { verified: true, onChainTaskId: parseInt(match[1], 10) };
}

// ---- Contract Calls (hot wallet) ----

/**
 * Calls mark-processing on the escrow contract.
 * Returns the broadcast transaction ID.
 */
export async function markTaskProcessing(onChainTaskId: number): Promise<string> {
  const { address, name } = parseContractId(
    process.env.TASK_ESCROW_CONTRACT ?? ""
  );
  const network = getStacksNetwork();
  const senderKey = getHotWalletKey();

  const tx = await makeContractCall({
    contractAddress: address,
    contractName: name,
    functionName: "mark-processing",
    functionArgs: [uintCV(onChainTaskId)],
    senderKey,
    network,
    validateWithAbi: false,
  });

  const result = await broadcastTransaction({ transaction: tx, network });
  if ("error" in result) throw new Error(`Broadcast failed: ${result.error}`);
  return result.txid;
}

/**
 * Calls complete-task on the escrow contract with result hash.
 * Returns the broadcast transaction ID.
 */
export async function completeTask(
  onChainTaskId: number,
  resultHashHex: string
): Promise<string> {
  const { address: escrowAddress, name: escrowName } = parseContractId(
    process.env.TASK_ESCROW_CONTRACT ?? ""
  );
  const { address: usdcxAddress, name: usdcxName } = parseContractId(
    process.env.USDCX_CONTRACT ?? ""
  );
  const network = getStacksNetwork();
  const senderKey = getHotWalletKey();

  const resultHashBuf = Buffer.from(resultHashHex, "hex");

  const tx = await makeContractCall({
    contractAddress: escrowAddress,
    contractName: escrowName,
    functionName: "complete-task",
    functionArgs: [
      uintCV(onChainTaskId),
      bufferCV(resultHashBuf),
      contractPrincipalCV(usdcxAddress, usdcxName),
    ],
    senderKey,
    network,
    validateWithAbi: false,
  });

  const result = await broadcastTransaction({ transaction: tx, network });
  if ("error" in result) throw new Error(`Broadcast failed: ${result.error}`);
  return result.txid;
}

// ---- Read-Only Queries ----

export async function getOnChainAgent(agentId: number): Promise<{
  name: string;
  priceUstx: number;
  owner: string;
  active: boolean;
  endpoint: string;
} | null> {
  const { address, name } = parseContractId(
    process.env.AGENT_REGISTRY_CONTRACT ?? ""
  );
  const network = getStacksNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName: "get-agent",
      functionArgs: [uintCV(agentId)],
      network,
      senderAddress: address,
    });

    const json = cvToJSON(result);
    if (!json.value || !json.value.value) return null;
    const agent = json.value.value;

    return {
      name: agent.name?.value ?? "",
      priceUstx: parseInt(agent["price-ustx"]?.value ?? "0", 10),
      owner: agent.owner?.value ?? "",
      active: agent.active?.value ?? false,
      endpoint: agent.endpoint?.value ?? "",
    };
  } catch {
    return null;
  }
}

export async function getOnChainTask(onChainTaskId: number): Promise<{
  client: string;
  agentId: number;
  amountUstx: number;
  status: number;
} | null> {
  const { address, name } = parseContractId(
    process.env.TASK_ESCROW_CONTRACT ?? ""
  );
  const network = getStacksNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName: "get-task",
      functionArgs: [uintCV(onChainTaskId)],
      network,
      senderAddress: address,
    });

    const json = cvToJSON(result);
    if (!json.value || !json.value.value) return null;
    const task = json.value.value;

    return {
      client: task.client?.value ?? "",
      agentId: parseInt(task["agent-id"]?.value ?? "0", 10),
      amountUstx: parseInt(task["amount-ustx"]?.value ?? "0", 10),
      status: parseInt(task.status?.value ?? "0", 10),
    };
  } catch {
    return null;
  }
}
