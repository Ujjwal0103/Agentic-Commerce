import Link from "next/link";
import type { Agent } from "../lib/api";

const SKILL_LABELS: Record<string, string> = {
  "web-research": "Research",
  "summarization": "Summarize",
  "data-analysis": "Data",
  "content-writing": "Content",
  "code-review": "Code",
};

interface AgentCardProps {
  agent: Agent;
}

export default function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.slug}`} className="block group">
      <div className="border border-gray-200 rounded-2xl p-6 hover:border-stacks-500 hover:shadow-md transition-all bg-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-stacks-600 transition-colors">
              {agent.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {agent.skills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-2 py-0.5 rounded-full bg-stacks-50 text-stacks-700 font-medium"
                >
                  {SKILL_LABELS[skill] ?? skill}
                </span>
              ))}
            </div>
          </div>
          {/* Active status */}
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              agent.active
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {agent.active ? "Available" : "Offline"}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
          {agent.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-900">
            {agent.priceDisplay}
          </span>
          <span className="text-sm text-stacks-600 font-medium group-hover:underline">
            Use Agent →
          </span>
        </div>
      </div>
    </Link>
  );
}
