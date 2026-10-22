# Muse Connector Submission Guide

## Product

**AD NŪTUM**

**Tagline:** Programmable authority for AI agents.

AD NŪTUM sits between an AI agent's proposed action and execution. It evaluates organizational policy, requires human approval when necessary, and issues signed authority receipts that downstream systems can verify before acting.

The Muse connector adds an application-level authority layer. It does not replace Muse's own permission and human-in-the-loop controls.

## Intended users

Developers and organizations that want Muse-triggered actions to obey their own project, environment, policy, and human-approval rules.

## Why a connector adds value beyond browsing

A browser can read documentation or open an administrative page. It cannot reliably answer the live authorization question:

> Is this agent authorized, under this organization's current policy, to perform this exact action in this environment and scope right now?

The connector queries live policy state and can return durable, signed authority evidence for downstream verification.

## Initial review scenario

Use a non-financial demonstration:

> "Request authority to deploy release 7.4 to the production environment."

The reviewer should observe:

1. Muse requests authority through `authorize_action`.
2. AD NŪTUM returns `approval_required`.
3. A separate authorized human approves the request outside Muse.
4. Muse checks `get_authorization_status`.
5. AD NŪTUM returns `authorized` and a signed authority receipt.
6. Muse calls `verify_authority_receipt` immediately before the hypothetical deployment.
7. Verification returns `valid: true`.
8. A revoked or expired receipt returns `valid: false`.

Muse is never given a Control Plane token or a human Owner credential, and Muse cannot approve its own request.

## Authentication

Muse-facing tools use an environment-scoped AD NŪTUM API key:

```http
Authorization: Bearer adn_...
```

Review credentials should be created specifically for the dedicated Muse reviewer project and Development or Staging environment.

Do not place the credential in prompts, tool descriptions, URLs, screenshots, or public documentation.

## Submitted tools

### 1. authorize_action

**Classification:** Sensitive Write for the initial connector submission.

**Endpoint:** `POST /v1/authorize`

**Purpose:** Ask AD NŪTUM whether a proposed agent action is allowed under current project/environment policy.

**Inputs:**

- `agentId` — connector agent identifier
- `action` — bounded action name
- optional `amount`
- optional `currency`
- optional structured `context`

**Side effects:**

- creates an authorization request;
- creates audit events;
- may issue an authority receipt immediately when policy returns `allow`;
- may create a durable pending request when policy returns `approval_required`.

**Possible results:**

- `allow`
- `deny`
- `approval_required`

The tool does **not** itself perform the downstream business action.

For the initial review, treat this tool as Sensitive Write because its output can authorize a consequential downstream action. Muse's own approval must be respected independently of AD NŪTUM policy.

### 2. get_authorization_status

**Classification:** Read

**Endpoint:** `GET /v1/requests/{requestId}/status`

**Purpose:** Resume a previously started authorization flow after required human input.

**Side effects:** No authorization state change. Authentication updates the API key's last-used timestamp.

**Access boundary:** The request must belong to the same project and environment as the API key.

**Possible statuses:**

- `pending_approval`
- `authorized`
- `approved`
- `rejected`
- `denied`

When authority exists, the response includes the resulting authority receipt.

This tool does not return human identity details, approval notes, audit history, or administrative credentials.

### 3. verify_authority_receipt

**Classification:** Read

**Endpoint:** `POST /v1/verify`

**Purpose:** Confirm that previously granted authority remains valid immediately before execution.

Although HTTP POST is used for a structured request body, the operation is read-only with respect to authorization state.

Verification checks current receipt state, delegation ancestry, agent, action, environment, execution scope, expiration, revocation, and signature integrity when present.

**Result:**

- `valid: true` only when current authority is valid;
- otherwise `valid: false` with a machine-readable reason.

## Tools intentionally excluded from the first Muse submission

The first connector does not expose:

- human approval or rejection;
- human identity creation, rotation, or revocation;
- Control Plane administration;
- signing-key administration or revocation;
- receipt delegation;
- receipt revocation;
- policy editing;
- API-key creation; or
- downstream payment or financial transfer execution.

These remain outside Muse so the connector cannot grant itself administrative or human authority.

## Status handling and retry behavior

When `authorize_action` returns `approval_required`, preserve the `requestId`. Do not submit a duplicate authorization request merely because human approval is still pending.

Use `get_authorization_status` to resume.

Before retrying an uncertain consequential workflow, check the existing request and receipt status first. Do not claim that a downstream action completed merely because an authority receipt was issued.

## Error handling

Common errors include:

- `401 api_key_required` — credential missing, invalid, or revoked;
- `404 request_not_found` — request does not exist in the calling project/environment or is not accessible;
- malformed request errors — required action fields are missing or invalid.

The connector should report failures honestly and should not retry blindly.

## Permissions and approval

Muse's permission system and AD NŪTUM policy are separate layers.

Muse approval answers whether Muse may invoke the connector tool.

AD NŪTUM answers whether the organization permits the underlying agent action under its own policy.

The connector must never bypass or weaken Muse's approval controls.

## Data processing

The connector should send only the minimum structured action data required for authorization. It does not require full conversation history.

See:

- [Privacy Notice](../PRIVACY.md)
- [Data Handling](./data-handling.md)
- [Security Policy](../SECURITY.md)
- [Product Terms](../TERMS.md)

## Rate limits

AD NŪTUM v1.4.0 does not advertise a product-specific application-level request quota. Reviewer credentials are for ordinary interactive testing and not for load testing. Infrastructure abuse protections may still apply.

## Reviewer environment

Before submission, create a dedicated reviewer project/environment with:

- a reviewer-only environment API key;
- representative non-sensitive policy data;
- a deployment-authorization scenario;
- a separate human Owner identity held by the reviewer-support operator, not Muse;
- no production customer data; and
- no payment credentials.

Keep the reviewer environment available for the duration of Meta's review.

## Support and security

**Support:** dev@rumblefleastudios.com

**Security:** dev@rumblefleastudios.com with subject prefix `[AD NŪTUM SECURITY]`

For a Muse Connector security incident involving user data, follow Meta's incident-reporting requirements in addition to AD NŪTUM's internal response process.
