"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchAgent, type Agent } from "../../../lib/api";
import TaskForm from "../../../components/TaskForm";
import WalletConnect, { type WalletUser } from "../../../components/WalletConnect";

const SKILL_LABELS: Record<string, string> = {
  "web-research": "Web Research",
  "summarization": "Summarization",
  "data-analysis": "Data Analysis",
  "content-writing": "Content Writing",
  "code-review": "Code Review",
};

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params["id"] as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletUser, setWalletUser] = useState<WalletUser | null>(null);

  // Restore wallet session
  useEffect(() => {
    try {
      const saved = localStorage.getItem("acn_wallet_user");
      if (saved) setWalletUser(JSON.parse(saved) as WalletUser);
    } catch { /* ignore */ }
  }, []);

  // Load agent data
  useEffect(() => {
    if (!id) return;
    fetchAgent(id)
      .then((data) => setAgent(data.agent))
      .catch(() => setError("Agent not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleTaskCreated = useCallback(
    (taskId: string) => router.push(`/tasks/${taskId}`),
    [router]
  );

  const handleConnect = useCallback((user: WalletUser) => setWalletUser(user), []);
  const handleDisconnect = useCallback(() => setWalletUser(null), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <svg className="animate-spin h-8 w-8 text-stacks-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-600 mb-4">{error ?? "Agent not found."}</p>
        <a href="/marketplace" className="text-stacks-500 hover:underline text-sm">
          ← Back to marketplace
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <a
        href="/marketplace"
        className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-block"
      >
        ← Marketplace
      </a>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* Agent profile — left 3 cols */}
        <div className="lg:col-span-3">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-stacks-100 flex items-center justify-center text-2xl flex-shrink-0">
              🤖
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{agent.name}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {agent.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-1 rounded-full bg-stacks-50 text-stacks-700 font-medium"
                  >
                    {SKILL_LABELS[skill] ?? skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed mb-6">{agent.description}</p>

          <div className="bg-gray-50 rounded-2xl p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Price per task</span>
              <span className="font-semibold">{agent.priceDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <span className="font-semibold">USDCx (SIP-010)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Escrow</span>
              <span className="font-semibold">Clarity smart contract</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${agent.active ? "text-green-600" : "text-gray-400"}`}>
                {agent.active ? "Available" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Task form — right 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-24">
            <h2 className="font-semibold text-gray-900 mb-1">Submit a task</h2>
            <p className="text-sm text-gray-500 mb-5">
              Connect your wallet to pay and submit.
            </p>

            {walletUser ? (
              <>
                <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
                  <span>Connected as {walletUser.address.slice(0, 8)}…</span>
                  <WalletConnect onConnect={handleConnect} onDisconnect={handleDisconnect} />
                </div>
                <TaskForm
                  agent={agent}
                  clientAddress={walletUser.address}
                  onTaskCreated={handleTaskCreated}
                />
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-4">
                  Connect your Leather or Xverse wallet to submit a task and pay via Stacks.
                </p>
                <WalletConnect onConnect={handleConnect} onDisconnect={handleDisconnect} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
