# Architecture

## Thesis

AI reasoning and organizational authority are different things.

A model may correctly determine what action would achieve a goal while still lacking authority to perform that action. AD NŪTUM creates a programmable boundary between an agent's proposed action and execution.

## Core flow

```text
Agent / application
        ↓
SDK or REST request
        ↓
API key resolves project + environment
        ↓
Policy evaluation
        ↓
allow | deny | approval_required
        ↓
Human decision when required
        ↓
Authority receipt
        ↓
Execution-time verification
        ↓
Consequential action
```

The reasoning layer, capability layer, and authority layer remain separate.

## Agent access

External agents authenticate with environment-scoped API keys.

Those keys can request authorization and verify authority without receiving Supabase credentials, Control Plane credentials, human identity credentials, or private signing material.

Raw API keys are shown once and stored as hashes with non-secret display metadata.

## Policy engine

The reference implementation demonstrates multiple policy shapes rather than one universal policy:

- monetary thresholds,
- vendor context,
- editorial approval,
- production-deployment approval,
- destructive-action restrictions,
- environment-sensitive denial.

The common result contract is:

- `allow`
- `deny`
- `approval_required`

## Human approval

Requests requiring human authorization are durable records with audit events.

The Control Plane supports individual `operator` and `owner` identities.

Governed signing-key revocation demonstrates structural separation of duties:

- a human identity requests the action,
- an Owner must approve it,
- the requester cannot approve their own request.

Human credentials support rotation and revocation. The final active Owner cannot be revoked through the lifecycle API.

## Authority receipts

An authorization request and an authority grant are intentionally different objects.

When authority is granted, AD NŪTUM issues an authority receipt describing:

- project,
- authorization request,
- agent,
- environment,
- action,
- execution scope,
- issuer,
- issue time,
- expiration,
- parent delegation when present.

Denied and rejected requests do not receive receipts.

## Delegation

Delegation transfers already-granted authority without widening it.

A delegated child inherits:

- action,
- environment,
- scope.

A child cannot outlive its parent, and parent expiration or revocation invalidates descendants during live verification.

## Execution-time verification

`POST /v1/verify` lets the executing system confirm that authority is still valid at the moment an action is about to occur.

Verification checks current receipt state, delegation ancestry, environment, agent, action, execution scope, expiry, revocation, and signature integrity when present.

This is distinct from offline cryptographic verification, which proves authenticity and integrity but cannot know about state changes that happened after issuance.

## Signed portable receipts

When signing is configured, AD NŪTUM signs authority receipts with ES256.

Private signing material remains in the runtime secret store.

Public verification keys and lifecycle state are distributed through:

`GET /.well-known/jwks.json`

Signing keys move through:

`active → retired → revoked`

Normal rotation retires an old key so historical receipts remain verifiable. Emergency revocation withdraws trust.

Revocation of signing trust is itself a governed action requiring human authorization.

## Persistence

Supabase stores durable state for:

- projects,
- environments,
- API keys,
- agents,
- authorization requests,
- approval decisions,
- audit events,
- authority receipts,
- signing-key lifecycle,
- human Control Plane identities.

Private receipt-signing material is not stored in Supabase.

## Runtime

The reference API is implemented as a Cloudflare Worker.

The Worker also serves the browser Control Plane used to:

- exercise policies,
- inspect requests,
- approve or reject pending actions,
- inspect and manage receipts,
- manage developer credentials,
- inspect signing trust,
- manage human identity lifecycle.

## Public SDK

The TypeScript SDK is intentionally small.

It wraps the REST contract and includes offline signed-receipt verification. The SDK does not embed policy logic or privileged infrastructure credentials.

## Security boundary

AD NŪTUM is an authorization layer. It is not:

- an identity provider,
- a fraud engine,
- a payment processor,
- a secret manager,
- an endpoint-protection product,
- a replacement for application authentication.

Deployments must protect credentials and define appropriate policies for their own risk model.
