# Security Policy

## Supported version

Security fixes are applied to the latest public release line.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected vulnerability that could expose credentials, bypass authorization, forge authority receipts, compromise signing keys, or weaken approval/separation-of-duties controls.

Report security issues privately to **dev@rumblefleastudios.com** with the subject prefix `[AD NŪTUM SECURITY]`, or contact the repository owner privately through GitHub. Include:

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


## Connector incident response

For a hosted connector integration, incidents involving connector user data are handled under the applicable connector terms and incident-notification obligations. Access credentials should be revoked promptly when compromise is suspected, and affected project-scoped data should be deleted or rendered inaccessible when required.
