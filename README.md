# AD NŪTUM — v0.6 Authority Receipts + Delegation

**Programmable authority for AI agents.**

AD NŪTUM sits between an agent's reasoning and a consequential action. It answers a simple question:

> Is this agent allowed to do this, in this environment, under this project's policy?

The response is one of:

- `allow`
- `deny`
- `approval_required`

v0.6 adds durable authority grants after a decision is made: receipts that can expire, be revoked, and be delegated without widening their original scope.

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


## CI safety net

Every pull request to `main` now runs:

- TypeScript typechecking
- Control Plane structural validation
- Headless Chromium smoke testing

The structural validator fails when browser JavaScript references a missing DOM id or when navigation points to a missing view.

The browser smoke test loads the generated Control Plane, unlocks it using mocked API responses, opens the Developer section, and fails on browser console or page errors.

This directly guards against the class of Control Plane assembly bugs discovered during the v0.4 rollout.


## v0.5 authority primitives

The live engine now recognizes six distinct action families:

- `refund_customer` — amount thresholds
- `increase_ad_budget` — daily spend increase thresholds
- `pay_invoice` — amount plus approved-vendor context
- `publish_content` — editorial approval with sensitive-content escalation
- `deploy_production` — engineering-lead approval
- `delete_record` — admin approval outside production, hard deny in production

These are intentionally different policy shapes. Together they demonstrate that AD NŪTUM can evaluate monetary thresholds, contextual facts, approval roles, environment sensitivity, and irreversible risk through one common authorization contract.

### Example outcomes

```text
$75/day ad increase              → allow
$500/day ad increase             → manager approval
$2,000/day ad increase           → owner approval

$240 approved-vendor invoice     → allow
$1,200 approved-vendor invoice   → manager approval
Any unapproved vendor            → owner approval

Routine public content           → editor approval
Sensitive public content         → owner approval

Production deployment            → engineering lead approval

Delete development record        → admin approval
Delete production record         → deny
```

## Authority Lab

The Control Plane's test-request panel is now an Authority Lab. Operators can select an action type and exercise the relevant context without manually crafting JSON.

This is intended to make the generality of the engine visible during demos while preserving the same API contract external agents use.


## v0.6 authority receipts

A request is not authority by itself.

AD NŪTUM now distinguishes between:

- an agent asking to do something
- policy evaluating the request
- a human approving when required
- authority actually being granted

When authority is granted, AD NŪTUM issues an **authority receipt**.

Automatic `allow` decisions receive a receipt immediately.

Requests requiring human approval receive a receipt only after the human approves them.

Denied or rejected requests never receive a receipt.

Each receipt records:

- project
- original authorization request when applicable
- agent
- environment
- action
- original scope / payload
- issuer
- issue time
- expiration time
- revocation state
- parent receipt when delegated

Receipts expire by default after 15 minutes in v0.6.

## Delegation

An active receipt can be delegated to another agent.

Delegation is intentionally narrow:

- the child inherits the parent's action
- the child inherits the parent's environment
- the child inherits the parent's scope
- the child cannot outlive the parent
- an expired or revoked parent cannot create a child

This makes delegation a transfer of already-granted authority rather than a way to manufacture broader authority.

Conceptually:

```text
owner approval
      ↓
authority receipt
      ↓
finance-agent
      ↓ delegates
assistant-agent
      ↓
same action + same scope + same environment
      ↓
expires no later than parent
```

## Revocation

An operator can revoke an active receipt from the Control Plane.

Revocation records:

- who revoked it
- when it was revoked
- why it was revoked

Revoked receipts remain visible for audit history but are no longer active grants.

## Control Plane Receipts view

The v0.6 Control Plane includes a **Receipts** section showing:

- active receipts
- expired receipts
- revoked receipts
- delegated receipts
- issuing identity
- environment
- expiration time

The same screen can create a delegated child receipt or revoke an active receipt.

## v0.6 Supabase migration

v0.6 requires running the updated `supabase/schema.sql`.

The migration adds the `authority_receipts` table and indexes. It is additive and does not remove existing requests, approvals, audit events, agents, environments, or API keys.
