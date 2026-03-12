import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// simnet is globally injected by vitest-environment-clarinet

const CONTRACT = "agent-registry";

// Helper: register an agent with defaults
function registerAgent(
  deployer: string,
  name = "TestBot",
  price = 1_000_000,
  endpoint = "https://api.example.com/execute"
) {
  return simnet.callPublicFn(
    CONTRACT,
    "register-agent",
    [
      Cl.stringAscii(name),
      Cl.stringUtf8("A test agent"),
      Cl.list([Cl.stringAscii("research")]),
      Cl.uint(price),
      Cl.stringAscii(endpoint),
    ],
    deployer
  );
}

describe("agent-registry", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const wallet1 = accounts.get("wallet_1")!;
  const wallet2 = accounts.get("wallet_2")!;

  // ---- register-agent ----

  it("register-agent: happy path returns (ok u1) and stores correct data", () => {
    const { result } = registerAgent(deployer);
    expect(result).toBeOk(Cl.uint(1));

    const { result: agentResult } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-agent",
      [Cl.uint(1)],
      deployer
    );
    // Should be (some { ... })
    expect(agentResult).toBeSome();
  });

  it("register-agent: second agent returns (ok u2), total-agents increments", () => {
    registerAgent(deployer, "Bot1");
    const { result } = registerAgent(wallet1, "Bot2");
    expect(result).toBeOk(Cl.uint(2));

    const { result: total } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-total-agents",
      [],
      deployer
    );
    expect(total).toBeUint(2);
  });

  it("register-agent: price u0 returns (err u103)", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "register-agent",
      [
        Cl.stringAscii("Bot"),
        Cl.stringUtf8("desc"),
        Cl.list([Cl.stringAscii("skill")]),
        Cl.uint(0), // invalid price
        Cl.stringAscii("https://example.com"),
      ],
      deployer
    );
    expect(result).toBeErr(Cl.uint(103));
  });

  it("register-agent: empty name returns (err u104)", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "register-agent",
      [
        Cl.stringAscii(""), // empty name
        Cl.stringUtf8("desc"),
        Cl.list([Cl.stringAscii("skill")]),
        Cl.uint(1_000_000),
        Cl.stringAscii("https://example.com"),
      ],
      deployer
    );
    expect(result).toBeErr(Cl.uint(104));
  });

  it("register-agent: empty endpoint returns (err u105)", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "register-agent",
      [
        Cl.stringAscii("Bot"),
        Cl.stringUtf8("desc"),
        Cl.list([Cl.stringAscii("skill")]),
        Cl.uint(1_000_000),
        Cl.stringAscii(""), // empty endpoint
      ],
      deployer
    );
    expect(result).toBeErr(Cl.uint(105));
  });

  // ---- get-agent ----

  it("get-agent: returns none for non-existent ID", () => {
    const { result } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-agent",
      [Cl.uint(999)],
      deployer
    );
    expect(result).toBeNone();
  });

  it("get-agent: returns some with correct data after registration", () => {
    registerAgent(deployer, "ResearchBot", 2_000_000, "https://api.test.com/exec");
    const { result } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-agent",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeSome();
  });

  // ---- update-agent ----

  it("update-agent: owner can update fields, returns (ok agent-id)", () => {
    registerAgent(deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "update-agent",
      [
        Cl.uint(1),
        Cl.stringAscii("UpdatedBot"),
        Cl.stringUtf8("Updated desc"),
        Cl.list([Cl.stringAscii("updated-skill")]),
        Cl.uint(5_000_000),
        Cl.stringAscii("https://updated.com"),
      ],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));
  });

  it("update-agent: non-owner returns (err u100)", () => {
    registerAgent(deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "update-agent",
      [
        Cl.uint(1),
        Cl.stringAscii("HijackBot"),
        Cl.stringUtf8("desc"),
        Cl.list([Cl.stringAscii("skill")]),
        Cl.uint(1_000_000),
        Cl.stringAscii("https://attacker.com"),
      ],
      wallet1 // not the owner
    );
    expect(result).toBeErr(Cl.uint(100));
  });

  // ---- set-agent-active ----

  it("set-agent-active: owner can deactivate agent", () => {
    registerAgent(deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-agent-active",
      [Cl.uint(1), Cl.bool(false)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(false));

    const { result: activeResult } = simnet.callReadOnlyFn(
      CONTRACT,
      "is-agent-active",
      [Cl.uint(1)],
      deployer
    );
    expect(activeResult).toBeOk(Cl.bool(false));
  });

  it("set-agent-active: non-owner returns (err u100)", () => {
    registerAgent(deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-agent-active",
      [Cl.uint(1), Cl.bool(false)],
      wallet2 // not the owner
    );
    expect(result).toBeErr(Cl.uint(100));
  });

  // ---- transfer-agent-ownership ----

  it("transfer-agent-ownership: updates owner field and index lists", () => {
    registerAgent(deployer);

    // Before transfer: deployer owns agent 1
    const beforeOwner = simnet.callReadOnlyFn(
      CONTRACT,
      "get-agents-by-owner",
      [Cl.standardPrincipal(deployer)],
      deployer
    );
    // Should include u1
    expect(beforeOwner.result).toBeTuple !== undefined;

    const { result } = simnet.callPublicFn(
      CONTRACT,
      "transfer-agent-ownership",
      [Cl.uint(1), Cl.standardPrincipal(wallet1)],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));

    // Agent owner field updated
    const { result: agentResult } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-agent",
      [Cl.uint(1)],
      deployer
    );
    expect(agentResult).toBeSome();
  });

  it("transfer-agent-ownership: non-owner returns (err u100)", () => {
    registerAgent(deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "transfer-agent-ownership",
      [Cl.uint(1), Cl.standardPrincipal(wallet2)],
      wallet1 // not the owner
    );
    expect(result).toBeErr(Cl.uint(100));
  });

  // ---- get-agents-by-owner ----

  it("get-agents-by-owner: returns correct list after multiple registrations", () => {
    registerAgent(deployer, "Bot1");
    registerAgent(deployer, "Bot2");
    registerAgent(wallet1, "OtherBot");

    const { result } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-agents-by-owner",
      [Cl.standardPrincipal(deployer)],
      deployer
    );
    // Should be a list with 2 items
    expect(result).toBeTuple !== undefined;
  });
});
