# AD NŪTUM — v0.1 Foundation

**Authorization infrastructure for AI agents.**

AD NŪTUM is an authorization service for AI agents. An agent asks whether it may take a consequential action. The service evaluates policy and returns one of three outcomes:

- `allow`
- `deny`
- `approval_required`

The first demo focuses on refunds because the policy is easy to understand and visibly consequential.

## v0.1 goal

Prove one complete loop:

1. Agent proposes an action.
2. Policy engine evaluates it.
3. Low-risk actions are allowed.
4. Prohibited actions are denied.
5. Higher-risk actions require human approval.
6. The decision is recorded in an audit trail.

## Repository layout

- `apps/api` — Cloudflare Worker-style API prototype
- `apps/demo` — zero-build browser playground
- `packages/sdk` — tiny TypeScript SDK developers can embed
- `supabase/schema.sql` — durable data model for the hosted control plane
- `docs/architecture.md` — product and architecture notes

## Core API

`POST /v1/authorize`

Example request:

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

## Default demo policy

- Under $100 → allow
- $100–$1,000 → approval required from manager
- Above $1,000 → approval required from owner
- Missing or non-positive amount → deny

## What is intentionally NOT in v0.1

- Billing
- OAuth
- production authentication
- notifications
- real Stripe refunds
- organization/team management
- production-grade cryptographic authorization tokens

Those come only after the authorization loop is proven.
