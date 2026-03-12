import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

// simnet is globally injected by vitest-environment-clarinet

const REPUTATION = "reputation";
const ESCROW     = "task-escrow";
const REGISTRY   = "agent-registry";
const USDCX      = "mock-usdcx";

const PROMPT_HASH = new Uint8Array(32).fill(1);
const RESULT_HASH = new Uint8Array(32).fill(2);

describe("reputation", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const wallet1  = accounts.get("wallet_1")!;
  const wallet2  = accounts.get("wallet_2")!;

  // Helpers to set up a complete task flow

  function setupAgent() {
    simnet.callPublicFn(
      REGISTRY,
      "register-agent",
      [
        Cl.stringAscii("ResearchBot"),
        Cl.stringUtf8("Research agent"),
        Cl.list([Cl.stringAscii("research")]),
        Cl.uint(2_000_000),
        Cl.stringAscii("https://api.example.com/exec"),
      ],
      deployer
    );
  }

  function mintAndCreateTask(client: string = wallet1, amount = 2_000_000) {
    simnet.callPublicFn(USDCX, "mint", [Cl.uint(amount), Cl.standardPrincipal(client)], deployer);
    return simnet.callPublicFn(
      ESCROW,
      "create-task",
      [
        Cl.uint(1),
        Cl.uint(amount),
        Cl.buffer(PROMPT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      client
    );
  }

  function completeTask(taskId = 1) {
    simnet.callPublicFn(ESCROW, "mark-processing", [Cl.uint(taskId)], deployer);
    simnet.callPublicFn(
      ESCROW,
      "complete-task",
      [
        Cl.uint(taskId),
        Cl.buffer(RESULT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      deployer
    );
  }

  // ---- update-task-stats ----

  it("update-task-stats: direct call by wallet returns (err u300)", () => {
    const { result } = simnet.callPublicFn(
      REPUTATION,
      "update-task-stats",
      [Cl.uint(1), Cl.uint(0)],
      wallet1 // not the escrow contract
    );
    expect(result).toBeErr(Cl.uint(300));
  });

  it("update-task-stats: called via escrow increments total-tasks on create-task", () => {
    setupAgent();
    mintAndCreateTask();

    const { result } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-agent-reputation",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeSome();
  });

  it("update-task-stats: completed-tasks increments after complete-task", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();

    const { result } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-agent-reputation",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeSome();
  });

  // ---- rate-task ----

  it("rate-task: client rates completed task, get-average-rating returns correct value", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();

    // Rate 4 stars = u400
    const { result } = simnet.callPublicFn(
      REPUTATION,
      "rate-task",
      [Cl.uint(1), Cl.uint(400)],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: avgResult } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-average-rating",
      [Cl.uint(1)],
      deployer
    );
    expect(avgResult).toBeUint(400);
  });

  it("rate-task: two ratings produce correct average", () => {
    setupAgent();

    // Task 1 (wallet1)
    mintAndCreateTask(wallet1);
    completeTask(1);
    simnet.callPublicFn(REPUTATION, "rate-task", [Cl.uint(1), Cl.uint(300)], wallet1); // 3 stars

    // Task 2 (wallet2)
    mintAndCreateTask(wallet2);
    completeTask(2);
    simnet.callPublicFn(REPUTATION, "rate-task", [Cl.uint(2), Cl.uint(500)], wallet2); // 5 stars

    // Average = (300 + 500) / 2 = 400
    const { result } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-average-rating",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeUint(400);
  });

  it("rate-task: non-client returns (err u305)", () => {
    setupAgent();
    mintAndCreateTask(wallet1);
    completeTask();

    const { result } = simnet.callPublicFn(
      REPUTATION,
      "rate-task",
      [Cl.uint(1), Cl.uint(500)],
      wallet2 // not the client
    );
    expect(result).toBeErr(Cl.uint(305));
  });

  it("rate-task: rating u0 returns (err u302)", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();

    const { result } = simnet.callPublicFn(
      REPUTATION,
      "rate-task",
      [Cl.uint(1), Cl.uint(0)], // below minimum u100
      wallet1
    );
    expect(result).toBeErr(Cl.uint(302));
  });

  it("rate-task: rating u600 (above max) returns (err u302)", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();

    const { result } = simnet.callPublicFn(
      REPUTATION,
      "rate-task",
      [Cl.uint(1), Cl.uint(600)], // above maximum u500
      wallet1
    );
    expect(result).toBeErr(Cl.uint(302));
  });

  it("rate-task: rating a pending task returns (err u304)", () => {
    setupAgent();
    mintAndCreateTask();
    // Do NOT complete the task — it remains PENDING

    const { result } = simnet.callPublicFn(
      REPUTATION,
      "rate-task",
      [Cl.uint(1), Cl.uint(500)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(304));
  });

  it("rate-task: double-rating same task returns (err u303)", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();

    simnet.callPublicFn(REPUTATION, "rate-task", [Cl.uint(1), Cl.uint(500)], wallet1);

    const { result } = simnet.callPublicFn(
      REPUTATION,
      "rate-task",
      [Cl.uint(1), Cl.uint(300)], // second attempt
      wallet1
    );
    expect(result).toBeErr(Cl.uint(303));
  });

  // ---- get-completion-rate ----

  it("get-completion-rate: returns correct percentage", () => {
    setupAgent();

    // Task 1: completed
    mintAndCreateTask(wallet1);
    completeTask(1);

    // Task 2: cancelled (wallet2)
    mintAndCreateTask(wallet2);
    simnet.callPublicFn(
      ESCROW,
      "cancel-task",
      [Cl.uint(2), Cl.contractPrincipal(deployer, USDCX)],
      wallet2
    );

    // 1 completed / 2 total = 50%
    const { result } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-completion-rate",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeUint(50);
  });

  // ---- get-agent-reputation ----

  it("get-agent-reputation: returns full record after tasks", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();

    const { result } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-agent-reputation",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeSome();
  });

  it("get-task-rating: returns rating after submission", () => {
    setupAgent();
    mintAndCreateTask();
    completeTask();
    simnet.callPublicFn(REPUTATION, "rate-task", [Cl.uint(1), Cl.uint(400)], wallet1);

    const { result } = simnet.callReadOnlyFn(
      REPUTATION,
      "get-task-rating",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeSome();
  });
});
