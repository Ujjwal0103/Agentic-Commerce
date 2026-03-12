"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import TaskStatus from "../../../components/TaskStatus";

export default function TaskPage() {
  const params = useParams();
  const taskId = params["id"] as string;
  const [clientAddress, setClientAddress] = useState("");

  // Read wallet address from storage (set by WalletConnect in layout)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("acn_wallet_user");
      if (saved) {
        const user = JSON.parse(saved) as { address: string };
        setClientAddress(user.address);
      }
    } catch { /* ignore */ }
  }, []);

  if (!taskId) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center text-gray-500">
        Invalid task ID.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <a
        href="/marketplace"
        className="text-sm text-gray-500 hover:text-gray-700 mb-8 inline-block"
      >
        ← Back to marketplace
      </a>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Result</h1>
      <p className="text-gray-500 text-sm mb-8 font-mono">{taskId}</p>

      <TaskStatus taskId={taskId} clientAddress={clientAddress} />
    </div>
  );
}
