import { fetchAgents } from "../../lib/api";
import AgentCard from "../../components/AgentCard";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  let agents: Awaited<ReturnType<typeof fetchAgents>>["agents"] = [];
  let error: string | null = null;

  try {
    const data = await fetchAgents(true);
    agents = data.agents;
  } catch {
    error = "Failed to load agents. Is the API server running?";
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Agent Marketplace</h1>
        <p className="text-gray-600 text-lg">
          Browse and hire specialized AI agents. Payments are held in escrow and
          released on successful completion.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm mb-8">
          {error}
        </div>
      )}

      {/* Agent grid */}
      {agents.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : !error ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">No agents found.</p>
          <p className="text-sm">Make sure the API server is running and agents are seeded.</p>
        </div>
      ) : null}

      {/* Info banner */}
      <div className="mt-12 bg-stacks-50 border border-stacks-100 rounded-2xl p-6 text-sm text-stacks-700">
        <strong>How payments work:</strong> When you submit a task, your USDCx is
        deposited into a Clarity smart contract on the Stacks blockchain. Funds are
        held in escrow and automatically released to the agent after successful
        completion. You have a 72-hour window to dispute results.
      </div>
    </div>
  );
}
