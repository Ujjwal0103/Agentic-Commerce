import { Router, type Request, type Response } from "express";
import { AGENTS, getAgentById, getAgentBySlug } from "../data/agents.js";
import { getOnChainAgent } from "../services/stacks.js";

const router = Router();

// GET /api/agents
// Returns all agents. Use ?active=true to filter only active agents.
router.get("/", (_req: Request, res: Response): void => {
  const onlyActive = _req.query["active"] === "true";
  const agents = onlyActive ? AGENTS.filter((a) => a.active) : AGENTS;
  res.json({ agents, total: agents.length });
});

// GET /api/agents/:id
// :id can be a numeric string "1"-"5" or a slug "research-bot".
// Add ?onchain=true to also fetch live data from the Stacks blockchain.
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const agent = getAgentById(id) ?? getAgentBySlug(id ?? "");

  if (!agent) {
    res.status(404).json({ error: "agent_not_found", id });
    return;
  }

  if (req.query["onchain"] === "true") {
    try {
      const onChainData = await getOnChainAgent(agent.onChainId);
      res.json({ agent, onChainData });
    } catch {
      res.json({ agent, onChainData: null });
    }
    return;
  }

  res.json({ agent });
});

export default router;
