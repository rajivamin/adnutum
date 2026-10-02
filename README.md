# AD NŪTUM — v0.4 Developer Onboarding

**Programmable authority for AI agents.**

AD NŪTUM sits between an agent's reasoning and a consequential action. It answers a simple question:

> Is this agent allowed to do this, in this environment, under this project's policy?

The response is one of:

- `allow`
- `deny`
- `approval_required`

v0.4 turns the working Control Plane into infrastructure another developer can actually integrate.

## What v0.4 adds

- Development, Staging, and Production environments
- Project-scoped API keys
- Environment-scoped API keys
- Bearer authentication for agent requests
- SHA-256-only API-key storage
- Key revocation
- Last-used timestamps
- One-time raw-key reveal
- Developer quickstart inside the Control Plane
- Existing human approval and audit flows preserved

## The separation of authority

AD NŪTUM now has two distinct access paths.

### Human operator

The Control Plane uses:

`x-control-plane-token`

It can inspect requests, approve or reject actions, manage policies, register agents, and create or revoke developer credentials.

### External software or agent

An agent uses:

`Authorization: Bearer adn_...`

It can request authorization through:

`POST /v1/authorize`

The API key determines the project and environment automatically.

This means an external integration never needs the Supabase secret, Cloudflare access, or the Control Plane token.

## Environments

A project receives three default environments:

- Development
- Staging
- Production

Keys are tied to one environment.

Example prefixes:

- `adn_dev_`
- `adn_stage_`
- `adn_live_`

An authorization request records the environment that produced it.

## API-key security

Raw API keys are shown once when created.

AD NŪTUM stores only a SHA-256 hash plus non-sensitive display metadata such as the prefix and last four characters.

Revoked keys cannot authorize new actions.

## 5-minute integration

Install the SDK:

```bash
npm install @adnutum/sdk
```

Create a client:

```ts
import { AdNutum } from "@adnutum/sdk";

const adnutum = new AdNutum({
  baseUrl: "https://adnutum-api.example.workers.dev",
  apiKey: process.env.ADNUTUM_API_KEY
});
```

Ask for authority:

```ts
const result = await adnutum.authorize({
  agentId: "finance-agent",
  action: "refund_customer",
  amount: 4800,
  currency: "USD",
  context: {
    customer: "ABC Manufacturing",
    reason: "Duplicate payment"
  }
});
```

Possible result:

```json
{
  "decision": "approval_required",
  "requiredApprover": "owner",
  "requestId": "req_..."
}
```

## Control Plane

The Worker root serves the browser Control Plane:

`GET /`

The Developer section lets an operator:

- inspect Development / Staging / Production
- create API keys
- copy a newly generated key once
- see key prefixes and last four characters
- see when a key was last used
- revoke keys
- view copy-paste integration examples

## Current policy proof

The first live policy remains intentionally narrow:

- under $100 → automatic authorization
- $100–$1,000 → manager approval
- above $1,000 → owner approval
- invalid amount → deny

The thresholds are stored in Supabase and editable through the Control Plane.

## Why this architecture matters for Muse and MCP

A future Muse connector, MCP server, or other agent integration should not need privileged access to AD NŪTUM's infrastructure.

It can hold an environment-specific API key and call the authorization endpoint before a consequential tool action.

Conceptually:

```text
Muse / MCP agent
      ↓
proposes action
      ↓
AD NŪTUM API key
      ↓
project + environment + policy
      ↓
allow | deny | approval_required
      ↓
tool executes only when authorized
```

This keeps the intelligence layer, capability layer, and authority layer separate.

## Supabase migration

Run the current `supabase/schema.sql` in the Supabase SQL Editor when upgrading from v0.3.

The migration is additive. It creates:

- `environments`
- `api_keys`
- `authorization_requests.environment_id`

Existing authorization history remains intact.

## Runtime variables

The Cloudflare Worker still requires:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DEFAULT_PROJECT_ID`
- `CONTROL_PLANE_TOKEN`

No new Cloudflare secret is required for v0.4.

## Repository layout

- `apps/api` — Cloudflare Worker API + Control Plane
- `apps/api/src/control-plane.ts` — browser Control Plane
- `packages/sdk` — TypeScript SDK
- `supabase/schema.sql` — durable schema
- `docs/architecture.md` — architecture notes

## Security boundary

v0.4 is developer-usable infrastructure, but it is not yet enterprise IAM.

Future milestones include organization identity, user accounts, RBAC, API-key rotation workflows, signed authorization receipts, rate limiting, policy versioning, webhooks, and broader action types.
