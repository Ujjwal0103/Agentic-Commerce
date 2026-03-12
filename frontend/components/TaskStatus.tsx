"use client";

import { useState, useEffect } from "react";
import { openContractCall } from "@stacks/connect";
import { buildRateTaskOptions } from "../lib/stacks";
import { fetchTask, type Task } from "../lib/api";

interface TaskStatusProps {
  taskId: string;
  clientAddress: string;
}

const STATUS_CONFIG: Record<
  Task["status"],
  { label: string; color: string; icon: string }
> = {
  pending:    { label: "Pending",    color: "text-yellow-700 bg-yellow-50", icon: "⏳" },
  processing: { label: "Processing", color: "text-blue-700 bg-blue-50",    icon: "⚙️" },
  completed:  { label: "Completed",  color: "text-green-700 bg-green-50",  icon: "✅" },
  disputed:   { label: "Disputed",   color: "text-red-700 bg-red-50",      icon: "⚠️" },
  refunded:   { label: "Refunded",   color: "text-gray-700 bg-gray-100",   icon: "↩️" },
  cancelled:  { label: "Cancelled",  color: "text-gray-700 bg-gray-100",   icon: "✕" },
};

const FINAL_STATUSES: Task["status"][] = ["completed", "disputed", "refunded", "cancelled"];

export default function TaskStatus({ taskId, clientAddress }: TaskStatusProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);

  // Poll for task status every 3 seconds until finalized
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const data = await fetchTask(taskId);
        setTask(data.task);
        if (FINAL_STATUSES.includes(data.task.status)) {
          clearInterval(timerId);
        }
      } catch (err) {
        console.error("Failed to fetch task:", err);
      }
    }

    poll(); // immediate first call
    timerId = setInterval(poll, 3000);
    return () => clearInterval(timerId);
  }, [taskId]);

  function handleRate(stars: number) {
    if (!task || ratingSubmitted) return;
    setPendingRating(stars);

    openContractCall(
      buildRateTaskOptions(
        task.onChainTaskId,
        stars,
        () => setRatingSubmitted(true),
        () => setPendingRating(0)
      ) as Parameters<typeof openContractCall>[0]
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-8 w-8 text-stacks-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[task.status];
  const isPolling = !FINAL_STATUSES.includes(task.status);
  const canRate =
    task.status === "completed" &&
    task.clientAddress === clientAddress &&
    !ratingSubmitted;

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${statusCfg.color}`}>
          <span>{statusCfg.icon}</span>
          {statusCfg.label}
        </span>
        {isPolling && (
          <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>

      {/* Result */}
      {task.resultText && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Result
          </h3>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
              {task.resultText}
            </pre>
          </div>
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {task.error}
        </div>
      )}

      {/* Rating */}
      {canRate && (
        <div className="bg-gray-50 rounded-2xl p-6">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Rate this result (on-chain)
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                disabled={pendingRating > 0}
                className={`text-2xl transition-transform hover:scale-110 disabled:cursor-not-allowed ${
                  star <= (pendingRating || 0) ? "opacity-50" : ""
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          {pendingRating > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Confirm {pendingRating}-star rating in your wallet...
            </p>
          )}
        </div>
      )}

      {ratingSubmitted && (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
          Rating submitted on-chain. Thank you!
        </p>
      )}

      {/* Meta */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>Task ID: <span className="font-mono">{task.id}</span></p>
        <p>On-chain ID: <span className="font-mono">#{task.onChainTaskId}</span></p>
        <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
        {task.paymentTxId && (
          <p>
            Payment TX:{" "}
            <span className="font-mono break-all">{task.paymentTxId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
