# AD NŪTUM

**Programmable authority for AI agents.**

AD NŪTUM sits between an AI agent's proposed action and execution. It evaluates policy, requires human approval when necessary, and can issue signed authority receipts that downstream systems verify before acting.

```text
agent proposes action
        ↓
AD NŪTUM evaluates policy
        ↓
allow | deny | approval_required
        ↓
human approval when required
        ↓
signed authority receipt
        ↓
execution-time verification
```

## What it does

- Evaluates consequential agent actions against project policy.
- Supports `allow`, `deny`, and `approval_required` decisions.
- Records Development, Staging, and Production environments.
- Issues short-lived authority receipts after authorization.
- Supports narrow delegation without expanding scope.
- Verifies authority at execution time.
- Signs receipts with ES256 when signing is configured.
- Publishes trusted verification keys through JWKS.
- Supports signing-key rotation, retirement, and governed revocation.
- Tracks individual human Operator and Owner identities.
- Enforces separation of duties for governed trust changes.
- Preserves audit history for requests, approvals, receipts, identity lifecycle, and trust changes.

## Install the TypeScript SDK

```bash
npm install @adnutum/sdk
```

> The npm package is being prepared for its first public release. Until publication, use the repository workspace package.

## Five-minute example

```ts
import { AdNutum } from "@adnutum/sdk";

const adnutum = new AdNutum({
  baseUrl: process.env.ADNUTUM_BASE_URL!,
  apiKey: process.env.ADNUTUM_API_KEY!
});

const result = await adnutum.authorize({
  agentId: "marketing-agent",
  action: "increase_ad_budget",
  amount: 75,
  currency: "USD",
  context: {
    campaign: "Holiday launch"
  }
});

switch (result.decision) {
  case "allow":
    console.log("Authorized", result.receipt);
    break;
  case "approval_required":
    console.log("Awaiting human approval", result.requestId);
    break;
  case "deny":
    console.log("Denied", result.reason);
    break;
}
```

## REST API

The core authorization endpoint is:

```http
POST /v1/authorize
Authorization: Bearer adn_...
Content-Type: application/json
```

Example request:

```json
{
  "agentId": "marketing-agent",
  "action": "increase_ad_budget",
  "amount": 75,
  "currency": "USD",
  "context": {
    "campaign": "Holiday launch"
  }
}
```

A policy result can be:

```json
{
  "decision": "allow",
  "policyId": "marketing-budget-v1",
  "reason": "Within automatic authority.",
  "requestId": "req_...",
  "receipt": {}
}
```

or:

```json
{
  "decision": "approval_required",
  "policyId": "marketing-budget-v1",
  "reason": "Owner approval required.",
  "requiredApprover": "owner",
  "requestId": "req_..."
}
```

The public REST contract is documented in [`openapi.yaml`](./openapi.yaml).

## Authority receipts

A request is not authority by itself.

When AD NŪTUM grants authority, it issues a receipt containing the agent, environment, action, execution scope, issuer, issue time, expiration time, and delegation lineage.

Receipts expire by default after 15 minutes.

A delegated child receipt:

- inherits its parent's action,
- inherits its parent's environment,
- inherits its parent's scope,
- cannot outlive its parent,
- becomes invalid if its parent expires or is revoked.

## Execution-time verification

Downstream systems can verify authority immediately before performing an action:

```http
POST /v1/verify
Authorization: Bearer adn_...
```

AD NŪTUM checks current receipt state, delegation ancestry, agent, action, environment, execution scope, expiry, revocation, and signature integrity when present.

A successful response is deliberately small:

```json
{
  "valid": true,
  "reason": "authority_verified"
}
```

## Signed portable receipts

When signing is configured, new authority receipts use ECDSA P-256 with SHA-256 (ES256).

The Worker keeps the private key secret and publishes trusted public verification keys at:

```http
GET /.well-known/jwks.json
```

The SDK can verify signed payload integrity offline:

```ts
import { verifySignedReceiptOffline } from "@adnutum/sdk";

const keys = await adnutum.getVerificationKeys();
const publicKey = keys.keys.find(k => k.kid === receipt.signing_key_id);

if (!publicKey) throw new Error("Verification key unavailable.");

const authentic = await verifySignedReceiptOffline(receipt, publicKey);
```

Offline verification proves signature authenticity and signed-payload integrity. Use `POST /v1/verify` when you also need current revocation, expiration, delegation, environment, agent, action, and scope state.

## Human authorization and separation of duties

The Control Plane supports individual human identities with `operator` and `owner` roles.

For governed signing-key revocation:

- an authenticated human identity must request the action,
- an Owner must approve it,
- the requester cannot approve their own request,
- revoked human credentials stop authenticating,
- the final active Owner cannot be revoked.

This prevents the administrative interface from bypassing the same authority principles AD NŪTUM applies to agents.

## Current demonstration policies

The reference implementation includes several policy shapes:

- customer refunds,
- advertising budget increases,
- vendor invoice payments,
- public content publishing,
- production deployment,
- destructive record deletion.

These demonstrate thresholds, context-sensitive policy, approval roles, environment sensitivity, and hard-deny behavior.

## Architecture

```text
AI agent / application
        ↓
SDK or REST API
        ↓
project + environment + policy
        ↓
allow | deny | approval_required
        ↓
human decision when required
        ↓
authority receipt
        ↓
downstream verification
        ↓
execution
```

The intelligence layer, capability layer, and authority layer remain separate.

See [Architecture](./docs/architecture.md) for more detail.

## Self-hosting

The reference API runs as a Cloudflare Worker with Supabase persistence.

Runtime configuration includes:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DEFAULT_PROJECT_ID`
- `CONTROL_PLANE_TOKEN`
- `SIGNING_PRIVATE_JWK` when signed receipts are enabled
- `SIGNING_KEY_ID` when signed receipts are enabled

Run the current additive schema in [`supabase/schema.sql`](./supabase/schema.sql).

## Security

Do not expose API keys, Control Plane tokens, human identity credentials, Supabase service credentials, or private signing keys in source control or browser applications.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and security boundaries.

## Development

```bash
npm install
npm run typecheck
npm run check:control-plane
npm run test:browser
npm run build:sdk
npm run pack:sdk:check
```

CI runs TypeScript typechecking, Control Plane structural validation, SDK packaging checks, and a headless Chromium smoke test.

## Repository layout

- `apps/api` — Cloudflare Worker API and browser Control Plane
- `packages/sdk` — TypeScript SDK
- `supabase/schema.sql` — additive database schema
- `openapi.yaml` — public REST contract
- `docs/architecture.md` — architecture notes
- `docs/build-history.md` — detailed development history
- `tests` — browser smoke tests

## Status

AD NŪTUM is a small, working authorization infrastructure project preparing for its first public SDK release and external connector review.

It is not an identity provider, payment processor, or substitute for an application's own authentication and authorization design.

## License

Apache-2.0.
