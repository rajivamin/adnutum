# AD NŪTUM Privacy Notice

**Effective date:** October 22, 2026

This notice describes how the hosted AD NŪTUM service processes information. AD NŪTUM is maintained by Rumble Flea Studios. Questions or deletion requests may be sent to **dev@rumblefleastudios.com**.

## What AD NŪTUM is

AD NŪTUM is authorization infrastructure for AI agents and applications. It receives a proposed action, evaluates policy, may require human approval, and can issue a signed authority receipt for downstream verification.

AD NŪTUM is not an identity provider, payment processor, advertising network, or data broker.

## Information the hosted service processes

Depending on how an integrator uses AD NŪTUM, the hosted service may process:

- project and environment identifiers;
- agent identifiers and display names;
- proposed action names;
- action parameters such as amount, currency, or structured context supplied by the integrator;
- authorization decisions and policy identifiers;
- human approval or rejection records;
- authority receipts, delegation state, expiration and revocation metadata;
- audit events;
- API-key and human-identity credential metadata, including hashes, prefixes, last-four-character display values, last-used timestamps, rotation timestamps, and revocation state; and
- public signing-key metadata used to verify signed receipts.

Raw API keys and raw human identity tokens are shown once and are not intentionally stored as reusable plaintext credentials. Private receipt-signing key material is expected to remain in the runtime secret store rather than the application database.

## Muse Connector data

When AD NŪTUM is used through a Muse Connector, the connector is designed to request only the information needed to evaluate and verify the specific authorization task.

The initial Muse integration is not intended to collect sensitive personal information, payment credentials, health information, government identifiers, or private communications. Integrators and users should not place unnecessary personal or sensitive information in free-form action context.

AD NŪTUM does not sell Connector user data, use it for unrelated advertising, build unrelated user profiles, or use Connector user data to train general-purpose AI models.

## How information is used

Information is used to:

- evaluate authorization policy;
- create durable authorization and approval records;
- issue and verify authority receipts;
- enforce environment and scope boundaries;
- support revocation and separation-of-duties controls;
- investigate errors or security incidents;
- maintain an audit history necessary for the authorization service; and
- operate, secure, support, and improve AD NŪTUM.

## Sharing and service providers

The reference hosted service uses infrastructure providers to operate the API and persistence layer. Information may be processed by those providers only as needed to host and operate AD NŪTUM.

Information may also be disclosed when required by law, to protect the security or integrity of the service, or to fulfill a user's requested integration action.

AD NŪTUM does not sell personal information.

## Retention and deletion

Authorization records are retained only while they are reasonably necessary to provide the authorization service, preserve required audit history, secure the service, or meet legal obligations.

For Muse Connector data, access is disabled when the associated connector or project credential is revoked. When Connector user data is no longer necessary, when access is revoked, or when a valid deletion request applies, the hosted service will delete the affected user data or render it inaccessible, subject to limited records that must be retained for security, legal, or compliance purposes.

The current public beta does not promise a fixed universal retention period because authorization and audit requirements differ by project. A project owner may request deletion of hosted project data by contacting **dev@rumblefleastudios.com**. Requests are verified before destructive action is taken.

## Security

AD NŪTUM uses scoped credentials, hashed stored credentials, environment separation, signed authority receipts, revocation controls, and separation of duties for governed trust changes. Transport security is provided over HTTPS.

No system can guarantee absolute security. Suspected vulnerabilities should be reported as described in [SECURITY.md](./SECURITY.md).

## Open-source SDK

The `@adnutum/sdk` package is open source under Apache-2.0. Installing the SDK alone does not send data to Rumble Flea Studios. Data is transmitted only when software using the SDK calls an AD NŪTUM endpoint configured by the integrator.

## Children's privacy

The hosted beta is intended for developers, organizations, and adult users configuring agent integrations. It is not directed to children under 13.

## Changes

This notice may be updated as AD NŪTUM changes. Material changes will be reflected by updating the effective date and the public repository copy.
