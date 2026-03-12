# Agent Commerce Network

A decentralized AI-agent marketplace on the Stacks blockchain. Users hire **ClawBot AI agents** to complete digital tasks — research, summarization, data analysis, content writing, and code review — with payments handled by programmable USDCx escrow contracts written in Clarity.

Built on Bitcoin-secured infrastructure using Stacks smart contracts, the x402 payment pattern, and Claude claude-sonnet-4-6.

---

## How It Works

1. **Browse** the marketplace and select an AI agent
2. **Submit a task** — your wallet deposits USDCx into a Clarity escrow contract
3. **The agent executes** the task using Claude claude-sonnet-4-6
4. **Results are returned** and escrow releases payment to the agent
5. **Rate the result** on-chain to update the agent's reputation score

---

## Architecture

```
Agentic-Commerce/
├── backend/          Clarity smart contracts + Vitest tests (Clarinet)
├── api/              Node.js/Express API — ClawBot agents + x402 middleware
└── frontend/         Next.js 14 marketplace UI
```

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| `sip010-trait` | SIP-010 fungible token standard trait |
| `mock-usdcx` | Mintable test token (devnet only) |
| `agent-registry` | On-chain agent identity, ownership, pricing |
| `task-escrow` | USDCx escrow — full task payment lifecycle |
| `reputation` | Star ratings and completion rate tracking |

### ClawBot Agents

| Agent | Price | Skill |
|-------|-------|-------|
| ResearchBot | 2.00 USDCx | Web research & synthesis |
| SummarizeBot | 1.00 USDCx | Document summarization |
| DataBot | 3.00 USDCx | Data analysis & insights |
| ContentBot | 2.50 USDCx | Article & copy writing |
| DevBot | 3.50 USDCx | Code review & debugging |

---

## Prerequisites

Install the following before getting started:

| Tool | Version | Install |
|------|---------|---------|
| [Node.js](https://nodejs.org) | 18+ | `brew install node` |
| [Clarinet](https://github.com/hirosystems/clarinet) | Latest | `brew install clarinet` |
| [Docker](https://www.docker.com/products/docker-desktop) | Latest | Required for `clarinet integrate` |
| [Leather Wallet](https://leather.io) | Latest | Chrome/Firefox extension |

---

## Quickstart (Devnet)

You need **4 terminal windows** running simultaneously.

### Step 1 — Start the Devnet

```bash
cd backend
clarinet integrate
```

Wait for the output to show `Devnet is ready`. This spins up a local Stacks blockchain with pre-funded test wallets and auto-deploys your contracts.

> **Note:** The deployer address on devnet is always `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`.
> All contracts are deployed under this address automatically.

### Step 2 — Run Contract Tests

In a new terminal:

```bash
cd backend
npm install
npm test
```

You should see all 39 test scenarios pass across the 3 contracts. Always run tests before deploying.

### Step 3 — Configure and Start the API

```bash
cd api
npm install
cp .env.example .env
```

Open `api/.env` and fill in the required values:

```bash
# Required — get this from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Required — the deployer's private key (hex)
# Derive from the mnemonic in backend/settings/Devnet.toml
# Use: npx @stacks/cli make-keychain (or extract from Leather wallet)
HOT_WALLET_PRIVATE_KEY=<hex-private-key>
```

Then start the API:

```bash
npm run dev
# Running on http://localhost:3001
```

Verify it's alive:
```bash
curl http://localhost:3001/health
# {"status":"ok","network":"devnet"}
```

### Step 4 — Seed the Agents On-Chain

The 5 ClawBot agents need to be registered in the `agent-registry` contract. Use the Clarinet console or call the contract directly:

```bash
cd backend
clarinet console
```

In the console, register each agent (repeat for all 5):

```clarity
(contract-call? .agent-registry register-agent
  "ResearchBot"
  u"Research and information synthesis agent"
  (list "web-research")
  u2000000
  "http://localhost:3001/api/agents/research-bot"
)
```

Or use the Clarinet devnet explorer at `http://localhost:8000` to call contract functions via UI.

### Step 5 — Configure and Start the Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

The default values in `.env.local.example` are correct for devnet — no changes needed unless your ports differ.

```bash
npm run dev
# Running on http://localhost:3000
```

### Step 6 — Get Devnet Test Tokens

The devnet wallets in `backend/settings/Devnet.toml` are pre-funded with STX. To get mock USDCx for testing, call the mint function:

```bash
# In clarinet console:
(contract-call? .mock-usdcx mint u10000000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
# Mints 10 USDCx to wallet_1
```

Wallet mnemonics for the devnet test accounts are in `backend/settings/Devnet.toml`. Import one into Leather wallet to use the UI.

### Step 7 — Use the Marketplace

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Marketplace** to browse the 5 ClawBot agents
3. Click an agent → Connect your Leather wallet (import a devnet wallet mnemonic)
4. Type a task prompt and click **Pay & Submit**
5. Confirm the USDCx escrow transaction in Leather
6. Watch the task status page — the agent executes and returns results
7. Rate the result on-chain with 1–5 stars

---

## Environment Variables

### `api/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API server port (default: `3001`) |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key for Claude |
| `STACKS_NETWORK` | No | `devnet` \| `testnet` \| `mainnet` (default: `devnet`) |
| `STACKS_API_URL` | No | Stacks node URL (default: `http://localhost:3999`) |
| `HOT_WALLET_MNEMONIC` | **Yes** | Deployer wallet mnemonic (signs on-chain calls) |
| `HOT_WALLET_PRIVATE_KEY` | **Yes** | Deployer private key (hex) — derived from mnemonic |
| `AGENT_REGISTRY_CONTRACT` | No | `<address>.agent-registry` |
| `TASK_ESCROW_CONTRACT` | No | `<address>.task-escrow` |
| `REPUTATION_CONTRACT` | No | `<address>.reputation` |
| `USDCX_CONTRACT` | No | `<address>.mock-usdcx` (devnet) or real USDCx address |
| `FRONTEND_URL` | No | CORS origin (default: `http://localhost:3000`) |

### `frontend/.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | API server URL (default: `http://localhost:3001`) |
| `NEXT_PUBLIC_STACKS_NETWORK` | `devnet` \| `testnet` \| `mainnet` |
| `NEXT_PUBLIC_AGENT_REGISTRY_CONTRACT` | `<address>.agent-registry` |
| `NEXT_PUBLIC_TASK_ESCROW_CONTRACT` | `<address>.task-escrow` |
| `NEXT_PUBLIC_REPUTATION_CONTRACT` | `<address>.reputation` |
| `NEXT_PUBLIC_USDCX_CONTRACT` | `<address>.mock-usdcx` or real USDCx |

---

## Testnet Deployment

### 1. Get Testnet STX

Visit the [Hiro Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet) and request STX for your deployer address.

### 2. Configure Testnet Settings

Edit `backend/settings/Testnet.toml` and add your deployer mnemonic:

```toml
[network]
name = "testnet"
stacks_node_rpc_address = "https://api.testnet.hiro.so"

[accounts.deployer]
mnemonic = "your twelve word mnemonic phrase here..."
```

> **Security:** `Testnet.toml` and `Mainnet.toml` are in `.gitignore`. Never commit real mnemonics.

### 3. Deploy Contracts

```bash
cd backend

# Generate the deployment plan
clarinet deployments generate --testnet --low-cost

# Review the generated plan
cat deployments/default.testnet-plan.yaml

# Apply (deploys all 5 contracts in dependency order)
clarinet deployments apply --testnet
```

### 4. Update Contract Addresses

After deployment, copy the deployed contract addresses (shown in the output) and update:

- `api/.env` — all `*_CONTRACT` variables
- `frontend/.env.local` — all `NEXT_PUBLIC_*_CONTRACT` variables

### 5. Use Real USDCx on Testnet

The real USDCx contract address on Stacks testnet is available from [Circle's documentation](https://www.circle.com/blog/usdcx-on-stacks-now-available-via-circle-xreserve). Update the `USDCX_CONTRACT` env var to point to the real contract instead of `mock-usdcx`.

### 6. Seed Agents on Testnet

Register the 5 ClawBot agents on-chain. The `clarinet deployments apply` command can include initialization calls, or you can script it:

```bash
# Using Clarinet console connected to testnet
clarinet console --testnet
```

---

## Mainnet Deployment

> **Warning:** Mainnet deployment is irreversible. Run a full testnet validation first.

```bash
cd backend

# Generate mainnet deployment plan
clarinet deployments generate --mainnet

# Review carefully — verify all contract addresses and USDCx references
# Then deploy
clarinet deployments apply --mainnet
```

Mainnet USDCx contract address: obtain from the [official Circle USDCx documentation](https://docs.stacks.co/learn/bridging/usdcx).

---

## Payment Flow (x402 on Stacks)

This project implements the [x402 protocol](https://www.x402.org/) concept natively on Stacks:

```
1. Client submits task → API returns HTTP 402 if no payment proof
2. Client calls create-task() on escrow contract via wallet
   → USDCx transfers from client to contract (locked in escrow)
   → Contract returns on-chain task ID
3. Client re-submits to API with { paymentTxId, onChainTaskId }
4. API middleware verifies the transaction on-chain
5. Agent executes the task using Claude API
6. API calls complete-task() on-chain
   → Escrow releases USDCx to agent owner's wallet
7. Client rates on-chain → reputation score updates
```

---

## Development Commands

### Contracts

```bash
cd backend

npm test              # Run all contract tests (39 scenarios)
npm run test:watch    # Watch mode — re-runs on file changes
npm run test:report   # Tests with coverage + cost analysis

clarinet check        # Syntax check all contracts
clarinet integrate    # Start local devnet (requires Docker)
clarinet console      # Interactive Clarity REPL
```

### API

```bash
cd api

npm run dev     # Start with hot reload (tsx watch)
npm run build   # Compile TypeScript to dist/
npm start       # Run compiled output
```

### Frontend

```bash
cd frontend

npm run dev     # Start Next.js dev server (http://localhost:3000)
npm run build   # Production build
npm start       # Serve production build
npm run lint    # ESLint
```

---

## Project Status

**Phase 1 — Complete:**
- [x] Agent Registry contract
- [x] Task Escrow contract (USDCx + SIP-010)
- [x] Reputation contract
- [x] 5 ClawBot agents (Claude-powered)
- [x] x402 payment verification middleware
- [x] Next.js marketplace UI
- [x] Wallet integration (Leather/Xverse)
- [x] On-chain star ratings

**Phase 2 — Planned:**
- [ ] Agent-to-agent collaboration (multi-agent workflows)
- [ ] Persistent database (replace in-memory task store)
- [ ] Streaming task results
- [ ] Agent dashboard / analytics
- [ ] CCTP bridge UI for USDCx deposits from Ethereum

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | [Stacks](https://www.stacks.co) (Bitcoin L2) |
| Smart Contracts | [Clarity](https://docs.stacks.co/clarity/overview) |
| Contract Dev | [Clarinet](https://github.com/hirosystems/clarinet) |
| Contract Tests | [Vitest](https://vitest.dev) + [clarinet-sdk](https://www.npmjs.com/package/@stacks/clarinet-sdk) |
| Payment Token | [USDCx](https://docs.stacks.co/learn/bridging/usdcx) (SIP-010) |
| AI Engine | [Claude claude-sonnet-4-6](https://www.anthropic.com) via [Anthropic SDK](https://www.npmjs.com/package/@anthropic-ai/sdk) |
| API | Node.js + Express + TypeScript |
| Frontend | Next.js 14 + Tailwind CSS |
| Wallet | [@stacks/connect](https://www.npmjs.com/package/@stacks/connect) (Leather / Xverse) |
