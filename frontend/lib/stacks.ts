"use client";

import {
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
  bufferCV,
  contractPrincipalCV,
  AnchorMode,
  PostConditionMode,
} from "@stacks/transactions";
import { StacksTestnet, StacksMainnet, StacksDevnet } from "@stacks/network";
import { CONTRACTS, parseContractId } from "./contracts";
import { createHash } from "crypto";

export function getNetwork() {
  const net = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? "devnet";
  if (net === "mainnet") return new StacksMainnet();
  if (net === "testnet") return new StacksTestnet();
  return new StacksDevnet();
}

export function getStacksApiBase(): string {
  const net = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? "devnet";
  if (net === "mainnet") return "https://api.hiro.so";
  if (net === "testnet") return "https://api.testnet.hiro.so";
  return "http://localhost:3999";
}

/** SHA-256 hash a prompt for on-chain storage (keeps prompt content private). */
export function hashPrompt(prompt: string): Uint8Array {
  return new Uint8Array(
    Buffer.from(createHash("sha256").update(prompt).digest())
  );
}

/** Read a single agent from the registry contract (no wallet required). */
export async function readOnChainAgent(agentId: number): Promise<{
  name: string;
  priceUstx: number;
  active: boolean;
  description: string;
} | null> {
  try {
    const { address, name } = parseContractId(CONTRACTS.agentRegistry);
    const result = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName: "get-agent",
      functionArgs: [uintCV(agentId)],
      network: getNetwork(),
      senderAddress: address,
    });

    const json = cvToJSON(result);
    if (!json.value?.value) return null;
    const agent = json.value.value;

    return {
      name: agent.name?.value ?? "",
      priceUstx: parseInt(agent["price-ustx"]?.value ?? "0", 10),
      active: agent.active?.value ?? false,
      description: agent.description?.value ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Build the options object for openContractCall to create a task.
 * Pass to openContractCall from @stacks/connect.
 */
export function buildCreateTaskOptions(
  agentId: number,
  amountUstx: number,
  promptHashBytes: Uint8Array,
  onFinish: (data: { txId: string }) => void,
  onCancel: () => void
) {
  const { address: escrowAddress, name: escrowName } = parseContractId(CONTRACTS.taskEscrow);
  const { address: usdcxAddress, name: usdcxName } = parseContractId(CONTRACTS.usdcx);

  return {
    contractAddress: escrowAddress,
    contractName: escrowName,
    functionName: "create-task",
    functionArgs: [
      uintCV(agentId),
      uintCV(amountUstx),
      bufferCV(Buffer.from(promptHashBytes)),
      contractPrincipalCV(usdcxAddress, usdcxName),
    ],
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    onFinish: (data: { txId: string }) => onFinish(data),
    onCancel,
  };
}

/**
 * Build the options object for openContractCall to rate a task.
 * rating: 1–5 integer; converted to 100–500 scale on-chain.
 */
export function buildRateTaskOptions(
  onChainTaskId: number,
  rating: number,
  onFinish: (data: { txId: string }) => void,
  onCancel: () => void
) {
  const { address, name } = parseContractId(CONTRACTS.reputation);

  return {
    contractAddress: address,
    contractName: name,
    functionName: "rate-task",
    functionArgs: [
      uintCV(onChainTaskId),
      uintCV(rating * 100),
    ],
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    onFinish: (data: { txId: string }) => onFinish(data),
    onCancel,
  };
}

/**
 * Poll the Stacks API until a transaction is confirmed.
 * Returns the on-chain task ID extracted from the tx result "(ok u<N>)".
 */
export async function pollForTaskId(txId: string): Promise<number> {
  const apiBase = getStacksApiBase();
  const cleanTxId = txId.startsWith("0x") ? txId : `0x${txId}`;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 5000));
    const resp = await fetch(`${apiBase}/extended/v1/tx/${cleanTxId}`);
    if (!resp.ok) continue;

    const data = (await resp.json()) as {
      tx_status: string;
      tx_result?: { repr: string };
    };

    if (data.tx_status === "success") {
      const match = data.tx_result?.repr?.match(/\(ok u(\d+)\)/);
      if (match?.[1]) return parseInt(match[1], 10);
      throw new Error("Could not parse task ID from transaction result");
    }

    if (
      data.tx_status === "abort_by_response" ||
      data.tx_status === "abort_by_post_condition"
    ) {
      throw new Error(`Transaction failed: ${data.tx_result?.repr ?? "unknown"}`);
    }
    // else: still pending — keep polling
  }
}
