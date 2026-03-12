import type { Request, Response, NextFunction } from "express";
import type { CreateTaskBody, PaymentRequiredBody } from "../types/index.js";
import { getAgentById } from "../data/agents.js";
import { verifyCreateTaskTx } from "../services/stacks.js";

/**
 * HTTP 402 Payment Required middleware — the Stacks-native x402 pattern.
 *
 * On POST /api/tasks:
 *  1. If paymentTxId or onChainTaskId are missing → return 402 with payment instructions.
 *  2. If present → verify the on-chain transaction.
 *  3. If verification fails → return 402.
 *  4. If verified → attach verified onChainTaskId to req.body and call next().
 */
export async function x402PaymentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const body = req.body as Partial<CreateTaskBody>;

  // --- Missing payment proof ---
  if (!body.paymentTxId || body.onChainTaskId === undefined || body.onChainTaskId === null) {
    const agent = body.agentId ? getAgentById(body.agentId) : undefined;

    const payment402: PaymentRequiredBody = {
      error: "payment_required",
      agentId: body.agentId ?? "",
      agentName: agent?.name ?? "Unknown Agent",
      priceUstx: agent?.priceUstx ?? 0,
      priceDisplay: agent?.priceDisplay ?? "0 USDCx",
      escrowContract: process.env.TASK_ESCROW_CONTRACT ?? "",
      instructions:
        "To submit a task, first call create-task() on the escrow contract (depositing USDCx), then re-submit this request with paymentTxId (the Stacks tx ID) and onChainTaskId (the task ID returned by the contract).",
    };

    res.status(402).json(payment402);
    return;
  }

  // --- Validate required fields ---
  if (!body.agentId || !body.prompt || !body.clientAddress) {
    res.status(400).json({ error: "missing_fields", required: ["agentId", "prompt", "clientAddress", "paymentTxId", "onChainTaskId"] });
    return;
  }

  const agent = getAgentById(body.agentId);
  if (!agent) {
    res.status(404).json({ error: "agent_not_found", agentId: body.agentId });
    return;
  }

  // --- Verify the on-chain payment ---
  try {
    const verification = await verifyCreateTaskTx(
      body.paymentTxId,
      agent.onChainId,
      body.clientAddress,
      agent.priceUstx
    );

    if (!verification.verified) {
      res.status(402).json({
        error: "payment_verification_failed",
        message: "Could not verify the payment transaction on-chain. Ensure the tx is confirmed and the arguments match.",
      });
      return;
    }

    // Attach the verified onChainTaskId (from tx result) back to body
    req.body.onChainTaskId = verification.onChainTaskId;
    next();
  } catch (err) {
    console.error("[x402] Verification error:", err);
    res.status(402).json({
      error: "payment_verification_error",
      message: "Error verifying payment. Please try again.",
    });
  }
}
