# Data Handling

This document describes the current hosted AD NŪTUM data model for integration and connector review.

## Data minimization

AD NŪTUM is designed to receive the minimum structured information needed to answer an authorization question:

- agent identifier;
- action;
- project/environment derived from the API key;
- optional amount and currency;
- optional structured context needed by the policy.

Connector integrations should omit unrelated conversation history and personal data. Free-form context should be narrowly scoped to the action being evaluated.

## Stored records

The reference persistence layer stores:

| Record | Purpose |
| --- | --- |
| Projects and environments | Scope authorization boundaries |
| Agents | Map external agent identifiers to a project |
| Policies | Evaluate actions |
| Authorization requests | Preserve the proposed action and decision |
| Approval decisions | Record human approval or rejection |
| Audit events | Preserve security and authorization history |
| Authority receipts | Represent granted authority |
| API-key metadata | Authenticate integrations without storing reusable raw keys |
| Human identity metadata | Authenticate Control Plane identities without storing reusable raw tokens |
| Signing-key public metadata | Verify signed authority receipts |

Private receipt-signing material is not stored in the application database.

## Credentials

Raw API keys and human identity tokens are shown once. The application persists cryptographic hashes and non-secret display metadata rather than reusable raw credentials.

Connector documentation and tool responses must never contain raw API keys, Control Plane tokens, human identity tokens, database service credentials, or private signing keys.

## Muse Connector processing

The proposed Muse integration exposes three tools:

1. **authorize_action** — submits the minimum action data needed for policy evaluation.
2. **get_authorization_status** — checks whether a previously submitted request is pending, denied, rejected, approved, or authorized.
3. **verify_authority_receipt** — checks whether issued authority is still valid immediately before execution.

The connector does not need full Muse conversation history.

The initial submission is designed for a technical demonstration such as production-deployment authorization. It is not a financial money-movement connector.

## Access boundaries

Agent API keys are bound to a project and environment.

The agent-safe status endpoint requires the same class of API key and returns a result only when the request belongs to the calling key's project and environment. It does not expose approval notes, audit-event payloads, human identity details, or Control Plane credentials.

Administrative and human-approval endpoints remain separate from Muse-facing tools.

## Retention

Authorization and audit records are retained only as long as reasonably necessary to operate and secure the authorization service, preserve required audit history, or meet legal obligations.

There is no universal automated time-to-live for all authorization records in the current beta because projects can have different audit requirements.

For Muse Connector data, the operational rule is stricter: retain it only while necessary for the user's connector request and delete or render it inaccessible when access is revoked, a valid deletion request applies, or the data is no longer necessary.

## Revocation and deletion

Revoking an API key immediately prevents that credential from creating new requests or accessing agent-scoped request status.

Project owners may request deletion of hosted project data at **dev@rumblefleastudios.com**. Requests are verified before destructive deletion. Where records must be retained for security, legal, or compliance reasons, access is restricted and only the minimum required record is retained.

Before broad public connector availability, the deletion process should be exercised against the dedicated reviewer project and documented as part of release operations.

## Service providers

The reference hosted deployment uses:

- Cloudflare Workers for the API/runtime; and
- Supabase/PostgreSQL for durable application state.

These providers process data only as needed to operate the hosted service under their applicable service terms.

## Security controls

Current controls include:

- HTTPS transport;
- project/environment-scoped API keys;
- hashed stored credentials;
- separate administrative and human credentials;
- short-lived authority receipts;
- ES256 signed receipts;
- execution-time verification;
- signing-key lifecycle and revocation;
- receipt revocation;
- separation of duties for governed trust changes; and
- final-active-Owner protection.

## Rate limits

AD NŪTUM v1.4.0 does not advertise a product-specific application-level request quota. Infrastructure providers may enforce platform abuse or resource protections.

The Muse reviewer credential is intended for ordinary interactive testing, not load testing. If a product-level quota is introduced, it will be documented in the API and connector materials.

## Incident response

Security incidents involving Muse Connector user data must be escalated immediately. The operator will notify Meta at the incident address required by the Muse Connector terms within the required 48-hour window and cooperate with investigation and remediation.

## Contact

Support, privacy, deletion, and security coordination: **dev@rumblefleastudios.com**
