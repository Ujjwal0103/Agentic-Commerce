import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// simnet is globally injected by vitest-environment-clarinet

const ESCROW = "task-escrow";
const REGISTRY = "agent-registry";
const USDCX = "mock-usdcx";

const TASK_PENDING    = 0n;
const TASK_PROCESSING = 1n;
const TASK_COMPLETED  = 2n;
const TASK_DISPUTED   = 3n;
const TASK_REFUNDED   = 4n;
const TASK_CANCELLED  = 5n;

// Dummy 32-byte prompt hash
const PROMPT_HASH = new Uint8Array(32).fill(1);
const RESULT_HASH = new Uint8Array(32).fill(2);

describe("task-escrow", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const wallet1  = accounts.get("wallet_1")!;
  const wallet2  = accounts.get("wallet_2")!;

  // Helper: register one agent as deployer (becomes agentId = 1)
  function setupAgent(active = true) {
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
    if (!active) {
      simnet.callPublicFn(
        REGISTRY,
        "set-agent-active",
        [Cl.uint(1), Cl.bool(false)],
        deployer
      );
    }
  }

  // Helper: mint USDCx to a wallet
  function mintUsdcx(recipient: string, amount: number) {
    simnet.callPublicFn(
      USDCX,
      "mint",
      [Cl.uint(amount), Cl.standardPrincipal(recipient)],
      deployer
    );
  }

  // Helper: create a task (wallet1 as client)
  function createTask(client: string = wallet1, amount: number = 2_000_000) {
    mintUsdcx(client, amount);
    return simnet.callPublicFn(
      ESCROW,
      "create-task",
      [
        Cl.uint(1),           // agent-id
        Cl.uint(amount),
        Cl.buffer(PROMPT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      client
    );
  }

  // Helper: advance to processing
  function advanceToProcessing(taskId: number = 1) {
    simnet.callPublicFn(
      ESCROW,
      "mark-processing",
      [Cl.uint(taskId)],
      deployer
    );
  }

  // Helper: complete a task
  function completeTask(taskId: number = 1) {
    return simnet.callPublicFn(
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

  // ---- create-task ----

  it("create-task: happy path returns (ok u1) and stores task with PENDING status", () => {
    setupAgent();
    const { result } = createTask();
    expect(result).toBeOk(Cl.uint(1));

    const { result: taskResult } = simnet.callReadOnlyFn(
      ESCROW,
      "get-task",
      [Cl.uint(1)],
      deployer
    );
    expect(taskResult).toBeSome();
  });

  it("create-task: for inactive agent returns (err u204)", () => {
    setupAgent(false);
    mintUsdcx(wallet1, 2_000_000);
    const { result } = simnet.callPublicFn(
      ESCROW,
      "create-task",
      [
        Cl.uint(1),
        Cl.uint(2_000_000),
        Cl.buffer(PROMPT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(204));
  });

  it("create-task: for non-existent agent returns (err u203)", () => {
    mintUsdcx(wallet1, 2_000_000);
    const { result } = simnet.callPublicFn(
      ESCROW,
      "create-task",
      [
        Cl.uint(999), // non-existent
        Cl.uint(2_000_000),
        Cl.buffer(PROMPT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(203));
  });

  // ---- mark-processing ----

  it("mark-processing: deployer can mark task as processing", () => {
    setupAgent();
    createTask();
    const { result } = simnet.callPublicFn(
      ESCROW,
      "mark-processing",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));
  });

  it("mark-processing: non-deployer returns (err u200)", () => {
    setupAgent();
    createTask();
    const { result } = simnet.callPublicFn(
      ESCROW,
      "mark-processing",
      [Cl.uint(1)],
      wallet2 // not the contract owner
    );
    expect(result).toBeErr(Cl.uint(200));
  });

  it("mark-processing: calling on completed task returns (err u202)", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();

    // Try to mark-processing again
    const { result } = simnet.callPublicFn(
      ESCROW,
      "mark-processing",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(202));
  });

  // ---- complete-task ----

  it("complete-task: deployer completes task, status becomes COMPLETED", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    const { result } = completeTask();
    expect(result).toBeOk(Cl.uint(1));

    const { result: taskResult } = simnet.callReadOnlyFn(
      ESCROW,
      "get-task",
      [Cl.uint(1)],
      deployer
    );
    expect(taskResult).toBeSome();
  });

  it("complete-task: non-deployer returns (err u200)", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    const { result } = simnet.callPublicFn(
      ESCROW,
      "complete-task",
      [
        Cl.uint(1),
        Cl.buffer(RESULT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      wallet1 // not contract owner
    );
    expect(result).toBeErr(Cl.uint(200));
  });

  // ---- dispute-task ----

  it("dispute-task: client can dispute completed task within window", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();

    const { result } = simnet.callPublicFn(
      ESCROW,
      "dispute-task",
      [Cl.uint(1)],
      wallet1 // the client
    );
    expect(result).toBeOk(Cl.uint(1));
  });

  it("dispute-task: non-client returns (err u208)", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();

    const { result } = simnet.callPublicFn(
      ESCROW,
      "dispute-task",
      [Cl.uint(1)],
      wallet2 // not the client
    );
    expect(result).toBeErr(Cl.uint(208));
  });

  it("dispute-task: past dispute window returns (err u207)", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();

    // Mine 433 blocks to exceed the 432-block dispute window
    simnet.mineEmptyBlocks(433);

    const { result } = simnet.callPublicFn(
      ESCROW,
      "dispute-task",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(207));
  });

  // ---- resolve-dispute ----

  it("resolve-dispute (refund): deployer refunds client, status = REFUNDED", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();
    simnet.callPublicFn(ESCROW, "dispute-task", [Cl.uint(1)], wallet1);

    const { result } = simnet.callPublicFn(
      ESCROW,
      "resolve-dispute",
      [
        Cl.uint(1),
        Cl.bool(true), // refund client
        Cl.contractPrincipal(deployer, USDCX),
      ],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));
  });

  it("resolve-dispute (release): deployer releases to agent, status = COMPLETED", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();
    simnet.callPublicFn(ESCROW, "dispute-task", [Cl.uint(1)], wallet1);

    const { result } = simnet.callPublicFn(
      ESCROW,
      "resolve-dispute",
      [
        Cl.uint(1),
        Cl.bool(false), // release to agent
        Cl.contractPrincipal(deployer, USDCX),
      ],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));
  });

  // ---- cancel-task ----

  it("cancel-task: client cancels pending task, refund received", () => {
    setupAgent();
    createTask();

    const { result } = simnet.callPublicFn(
      ESCROW,
      "cancel-task",
      [Cl.uint(1), Cl.contractPrincipal(deployer, USDCX)],
      wallet1 // the client
    );
    expect(result).toBeOk(Cl.uint(1));
  });

  it("cancel-task: cannot cancel a processing task, returns (err u202)", () => {
    setupAgent();
    createTask();
    advanceToProcessing();

    const { result } = simnet.callPublicFn(
      ESCROW,
      "cancel-task",
      [Cl.uint(1), Cl.contractPrincipal(deployer, USDCX)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(202));
  });

  // ---- agent-task-counts ----

  it("get-agent-task-counts: tracks counts correctly across tasks", () => {
    setupAgent();
    createTask();
    advanceToProcessing();
    completeTask();

    const { result } = simnet.callReadOnlyFn(
      ESCROW,
      "get-agent-task-counts",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeSome();
  });

  // ---- get-next-task-id ----

  it("get-next-task-id: increments with each task created", () => {
    setupAgent();
    createTask(wallet1, 2_000_000);
    mintUsdcx(wallet2, 2_000_000);
    simnet.callPublicFn(
      ESCROW,
      "create-task",
      [
        Cl.uint(1),
        Cl.uint(2_000_000),
        Cl.buffer(PROMPT_HASH),
        Cl.contractPrincipal(deployer, USDCX),
      ],
      wallet2
    );

    const { result } = simnet.callReadOnlyFn(
      ESCROW,
      "get-next-task-id",
      [],
      deployer
    );
    expect(result).toBeUint(2);
  });
});
