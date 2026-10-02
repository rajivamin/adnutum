# AD NŪTUM — v0.2 Persistence

**Authorization infrastructure for AI agents.**

AD NŪTUM places a programmable authority boundary between an AI agent's reasoning and consequential actions.

An agent asks whether it may act. AD NŪTUM evaluates policy and returns one of three outcomes:

- `allow`
- `deny`
- `approval_required`

v0.2 makes that lifecycle durable. Authorization requests, human decisions, and audit events are persisted in Supabase instead of disappearing when a process ends.

## v0.2 goal

Prove one complete durable loop:

1. Agent proposes an action.
2. Policy engine evaluates it.
3. The authorization request is persisted.
4. Low-risk actions are allowed.
5. Prohibited actions are denied.
6. Higher-risk actions require human approval.
7. Human approval or rejection is persisted.
8. Every material step is appended to the audit ledger.
9. The request can be retrieved later with its approval and audit history.

## Repository layout

- `apps/api` — Cloudflare Worker-style authorization API
- `apps/demo` — zero-build browser playground
- `packages/sdk` — TypeScript SDK developers can embed
- `supabase/schema.sql` — durable hosted-control-plane data model
- `docs/architecture.md` — product and architecture notes

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

Example response:

```json
{
  "decision": "approval_required",
  "policyId": "refund-threshold-default",
  "reason": "Refunds above $1,000 require owner approval.",
  "requestId": "req_..."
}
```

### Record the human decision

`POST /v1/requests/:requestId/decision`

```json
{
  "decision": "approved",
  "decidedBy": "owner",
  "note": "Duplicate charge verified."
}
```

### Retrieve the durable record

`GET /v1/requests/:requestId`

Returns the authorization request, approval decisions, and ordered audit events.

## Default demo policy

- Under $100 → allow
- $100–$1,000 → approval required from manager
- Above $1,000 → approval required from owner
- Missing or non-positive amount → deny

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor, then create one project row:

```sql
insert into projects (name)
values ('AD NŪTUM Demo')
returning id;
```

Keep the returned UUID. The API requires three server-side environment values:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DEFAULT_PROJECT_ID`

**Never expose the Supabase service-role key in browser code or commit it to GitHub.**

For local development, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and fill in your own values. `.dev.vars` is ignored by Git.

## What is intentionally NOT in v0.2

- Billing
- OAuth
- production API-key authentication
- notifications
- real Stripe refunds
- organization/team management
- production-grade cryptographic authorization tokens

Those remain outside the build until the durable authorization loop is proven.
