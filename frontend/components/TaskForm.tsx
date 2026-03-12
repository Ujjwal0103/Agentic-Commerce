"use client";

import { useState } from "react";
import { openContractCall } from "@stacks/connect";
import { hashPrompt, buildCreateTaskOptions, pollForTaskId } from "../lib/stacks";
import { createTask, executeTask, type Agent } from "../lib/api";

type FormState =
  | "idle"
  | "awaiting_wallet"    // waiting for wallet to confirm tx
  | "confirming_tx"      // polling Stacks API for tx confirmation
  | "creating_task"      // POST /api/tasks
  | "executing"          // POST /api/tasks/:id/execute
  | "error";

const STATE_LABELS: Record<FormState, string> = {
  idle: "Pay & Submit",
  awaiting_wallet: "Waiting for wallet...",
  confirming_tx: "Confirming on-chain...",
  creating_task: "Registering task...",
  executing: "Starting agent...",
  error: "Try Again",
};

interface TaskFormProps {
  agent: Agent;
  clientAddress: string;
  onTaskCreated: (taskId: string) => void;
}

export default function TaskForm({ agent, clientAddress, onTaskCreated }: TaskFormProps) {
  const [prompt, setPrompt] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = formState !== "idle" && formState !== "error";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    setError(null);
    setFormState("awaiting_wallet");

    const promptHashBytes = hashPrompt(prompt.trim());

    openContractCall(
      buildCreateTaskOptions(
        agent.onChainId,
        agent.priceUstx,
        promptHashBytes,
        async (txData) => {
          // Wallet confirmed tx — now poll for on-chain confirmation
          try {
            setFormState("confirming_tx");
            const onChainTaskId = await pollForTaskId(txData.txId);

            setFormState("creating_task");
            const response = await createTask({
              agentId: agent.id,
              prompt: prompt.trim(),
              clientAddress,
              paymentTxId: txData.txId,
              onChainTaskId,
            });

            if ("requiresPayment" in response && response.requiresPayment) {
              setFormState("error");
              setError("Payment verification failed. Please try again.");
              return;
            }

            if (!("taskId" in response)) {
              setFormState("error");
              setError("Failed to create task. Please try again.");
              return;
            }

            setFormState("executing");
            await executeTask(response.taskId);
            onTaskCreated(response.taskId);
          } catch (err: unknown) {
            setFormState("error");
            setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
          }
        },
        () => {
          setFormState("idle");
          setError("Transaction cancelled.");
        }
      ) as Parameters<typeof openContractCall>[0]
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Prompt input */}
      <div>
        <label
          htmlFor="prompt"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Describe your task
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isLoading}
          placeholder={`Tell ${agent.name} what you need...`}
          rows={5}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-stacks-500 focus:border-transparent disabled:opacity-50 resize-none"
          required
        />
      </div>

      {/* Price summary */}
      <div className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-3">
        <span className="text-gray-600">Payment to escrow</span>
        <span className="font-semibold text-gray-900">{agent.priceDisplay}</span>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className="w-full py-3 px-6 rounded-xl bg-stacks-500 text-white font-medium text-sm hover:bg-stacks-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {STATE_LABELS[formState]}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Your wallet will prompt you to deposit {agent.priceDisplay} into escrow. Funds release when the task completes.
      </p>
    </form>
  );
}
