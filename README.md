# AD NŪTUM — v0.8 Signed Authority Receipts

**Programmable authority for AI agents.**

AD NŪTUM sits between an agent's reasoning and a consequential action. It answers a simple question:

> Is this agent allowed to do this, in this environment, under this project's policy?

The response is one of:

- `allow`
- `deny`
- `approval_required`

v0.8 adds cryptographic provenance to authority receipts. New receipts can be signed by AD NŪTUM with an asymmetric P-256 private key and verified by downstream systems with the public key.

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

Future milestones include organization identity, user accounts, RBAC, API-key rotation workflows, rate limiting, policy versioning, webhooks, key rotation/status distribution, and broader action types.


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


## v0.7 execution-time verification

A receipt is useful evidence, but an execution system needs a live answer.

v0.7 adds:

`POST /v1/verify`

A downstream tool can present:

- receipt ID
- agent ID
- action
- amount when relevant
- currency when relevant
- execution context

AD NŪTUM verifies that:

- the receipt exists
- the receipt is active
- every parent receipt in the delegation chain is active
- the calling API key belongs to the same environment
- the agent matches the receipt holder
- the action matches the granted action
- the execution scope exactly matches the granted scope

The response is deliberately simple:

```json
{
  "valid": true,
  "reason": "authority_verified"
}
```

or:

```json
{
  "valid": false,
  "reason": "scope_mismatch"
}
```

Other invalidation reasons include:

- `receipt_not_found`
- `receipt_expired`
- `receipt_revoked`
- `parent_receipt_expired`
- `parent_receipt_revoked`
- `agent_mismatch`
- `action_mismatch`
- `environment_mismatch`

Verification attempts are written to the audit log.

### Why parent state matters

Delegated authority depends on the authority it came from.

If a parent receipt expires or is revoked, its descendants no longer verify successfully even if a child record itself has not yet been individually revoked.

### Scope matching

v0.7 stores only material execution scope in new receipts:

- amount
- currency
- context fields other than descriptive `reason`

This avoids treating narrative explanation as authorization scope while still preventing an agent from changing the actual transaction parameters at execution time.

### Control Plane

The Receipts view now includes a **Verify authority** panel for live demonstrations.

The delegate-agent field also uses a real default value rather than a visual placeholder, removing the ambiguity found during v0.6 validation.


## v0.8 signed authority receipts

v0.8 can cryptographically sign every newly issued authority receipt using **ECDSA P-256 with SHA-256 (ES256)**.

The private signing key stays in the Cloudflare Worker as a secret.

The public verification key is exposed at:

`GET /.well-known/jwks.json`

This lets another service verify that:

- the receipt was signed by AD NŪTUM
- the signed grant payload has not been altered
- the receipt ID, project, agent, environment, action, scope, issuer, issue time, expiration, and parent receipt are exactly what AD NŪTUM signed

### Portable receipt

For automatic `allow` decisions, the authorization response now includes the newly issued receipt.

That means a caller can receive:

```text
allow
  +
signed authority receipt
```

and present that receipt to a downstream system.

Human-approved requests also return the receipt when the approval is recorded.

### Offline cryptographic verification

The SDK exports:

`verifySignedReceiptOffline(receipt, publicJwk)`

and can retrieve the public keys with:

`adnutum.getVerificationKeys()`

The offline helper verifies **signature authenticity and payload integrity**.

It does not independently know whether a receipt was revoked after issuance.

For current authority state, use:

`POST /v1/verify`

That endpoint continues to check expiration, revocation, delegation ancestry, agent, action, environment, scope, and now signed-receipt integrity when a signature is present.

### Signed payload

The signature covers a canonical payload containing:

- receipt ID
- project ID
- original authorization request ID
- parent receipt ID
- agent ID
- environment ID
- action
- execution scope
- issuer
- issued-at time
- expiration time

Mutable operational fields such as revocation timestamps are intentionally not part of the original signature claim.

### Backward compatibility

Existing v0.6/v0.7 receipts remain readable and verifiable through the live authority endpoint.

If no signing key is configured, AD NŪTUM continues issuing ordinary unsigned receipts rather than breaking authorization.

Once signing is configured, newly issued receipts are signed automatically.

### Generate a signing key

From the repository root:

```bash
npm run generate:signing-key
```

The command prints:

- `SIGNING_KEY_ID`
- `SIGNING_PRIVATE_JWK`
- the corresponding public JWK

Keep the private JWK secret. Never commit it to Git.

Configure these Worker values:

- `SIGNING_PRIVATE_JWK` as a Cloudflare **Secret**
- `SIGNING_KEY_ID` as a normal variable or secret

The public key does not need to be stored separately because AD NŪTUM derives it from the private JWK.

## v0.8 Supabase migration

v0.8 adds signature metadata to `authority_receipts`:

- `signed_payload`
- `signature`
- `signing_key_id`
- `signature_algorithm`

The migration is additive and has already been designed to preserve all existing receipt history.


## v0.8.2 offline verification demo

The Control Plane now includes **Copy portable receipt** for signed receipts.

A copied portable receipt can be saved as `receipt.json` and verified locally with:

```bash
npm run verify:receipt -- receipt.json
```

The verifier fetches only the public key from:

`/.well-known/jwks.json`

It does **not** call `/v1/verify`.

A valid signed receipt prints:

```text
SIGNATURE VALID
Verified locally without calling /v1/verify.
```

This proves receipt origin and signed-payload integrity independently of the live authority-check endpoint.

Offline verification does not prove that the receipt has not been revoked since issuance. Use `POST /v1/verify` when current revocation / expiration / delegation state matters.
