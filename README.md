# AD NŪTUM — v0.3 Control Plane

**Authorization infrastructure for AI agents.**

AD NŪTUM places a programmable authority boundary between an AI agent's reasoning and consequential actions.

An agent asks whether it may act. AD NŪTUM evaluates policy and returns one of three outcomes:

- `allow`
- `deny`
- `approval_required`

v0.3 adds the first human-usable Control Plane on top of the durable v0.2 backend.

## v0.3 goal

Replace PowerShell and raw database inspection with an operator cockpit that can:

1. See authorization requests and their current state.
2. Open a request and inspect its evidence.
3. Approve or reject requests that require human judgment.
4. Read the audit trail.
5. Register agent identities.
6. Edit the live refund authority thresholds.
7. Create test authorization requests from the browser.

## Control Plane

The Worker root path serves the Control Plane:

`GET /`

The browser asks for a Control Plane token and sends it in:

`x-control-plane-token`

The token is stored only in browser session storage.

Control Plane routes such as request listings, decisions, agents, and policy editing require that token. The agent-facing authorization route remains separate:

`POST /v1/authorize`

## Core API

### Authorize an action

`POST /v1/authorize`

```json
{
  "agentId": "finance-agent",
  "action": "refund_customer",
  "amount": 4800,
  "currency": "USD",
  "context": {
    "customer": "ABC Manufacturing",
    "reason": "Duplicate payment"
  }
}
```

### List requests

`GET /v1/requests`

Requires the Control Plane token.

### Inspect a request

`GET /v1/requests/:requestId`

Requires the Control Plane token.

### Record a human decision

`POST /v1/requests/:requestId/decision`

Requires the Control Plane token.

### Manage agents

`GET /v1/agents`

`POST /v1/agents`

Require the Control Plane token.

### Read or update the refund policy

`GET /v1/policies/refund_customer`

`PUT /v1/policies/refund_customer`

Require the Control Plane token.

## Runtime variables

The Cloudflare Worker requires:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DEFAULT_PROJECT_ID`
- `CONTROL_PLANE_TOKEN`

**Never expose the Supabase secret key in browser code or commit it to GitHub.**

For local development, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and fill in your own values. `.dev.vars` is ignored by Git.

## Repository layout

- `apps/api` — Cloudflare Worker API + Control Plane
- `apps/api/src/control-plane.ts` — browser Control Plane
- `apps/demo` — original zero-build v0.1 playground
- `packages/sdk` — TypeScript SDK
- `supabase/schema.sql` — durable hosted-control-plane data model
- `docs/architecture.md` — product and architecture notes

## Default demo policy

The first live policy remains intentionally narrow:

- Under $100 → allow
- $100–$1,000 → manager approval
- Above $1,000 → owner approval
- Missing or non-positive amount → deny

In v0.3 those thresholds are now stored in Supabase and editable from the Control Plane.

## Security boundary

v0.3 is a protected demo environment, not production IAM.

The Control Plane token protects operator routes, while the Supabase secret remains server-side inside Cloudflare. Production API keys, OAuth, RBAC, signed authorization tokens, rate limiting, and organization-level identity remain future milestones.
