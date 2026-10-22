# Security Policy

## Supported version

AD NŪTUM is currently preparing its first public release. Security fixes are applied to the latest release line.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected vulnerability that could expose credentials, bypass authorization, forge authority receipts, compromise signing keys, or weaken approval/separation-of-duties controls.

Until a dedicated security mailbox is published, contact the repository owner privately through GitHub and include:

- a concise description of the issue,
- affected endpoint or component,
- reproduction steps,
- expected versus observed behavior,
- potential impact,
- any proof-of-concept material that is safe to share.

Do not include live secrets, production credentials, private signing keys, or personal data in reports.

## Security model

AD NŪTUM separates several credential classes:

- agent API keys,
- Control Plane bootstrap/admin token,
- individual human identity tokens,
- Supabase service credentials,
- private receipt-signing keys.

These credentials are not interchangeable.

Raw API keys and human identity tokens are shown once. Stored application records contain hashes and non-secret display metadata rather than reusable raw credentials.

Private receipt-signing key material is expected to remain in the runtime secret store. Supabase stores public verification material and key lifecycle state, not private signing key material.

## Authority receipts

Signed receipts prove that AD NŪTUM signed a specific authority grant and that the signed payload has not been altered.

Offline signature verification does not establish current authorization state. A previously valid receipt may later expire, be revoked, or become invalid through delegation ancestry.

Use live execution-time verification when current state matters.

## Human approval

Governed trust revocation requires an authenticated Owner identity. The same human identity that requested a governed signing-key revocation cannot approve its own request.

The final active Owner identity cannot be revoked through the lifecycle API.

## Deployment responsibility

Self-hosters are responsible for:

- protecting runtime secrets,
- configuring TLS,
- restricting Control Plane access,
- setting appropriate Supabase permissions,
- rotating compromised credentials,
- monitoring audit events,
- validating policies for their own use cases.

AD NŪTUM is authorization infrastructure, not a substitute for application authentication, endpoint security, identity proofing, fraud controls, or payment security.
