# Changelog

All notable public release changes to AD NŪTUM are recorded here.

## 1.3.1 - Release hardening

- Package the TypeScript SDK as compiled JavaScript with declaration files.
- Add npm package metadata and public-package configuration.
- Add focused SDK and repository README files.
- Add OpenAPI documentation for the public authorization API.
- Add security and licensing documentation.
- Preserve detailed historical build notes under `docs/build-history.md`.
- Add SDK build and package-content checks to CI.

## 1.3.0 - Human identity lifecycle

- Add human identity token rotation.
- Add human identity revocation and revocation reasons.
- Add explicit revoked-token handling.
- Add last-active-Owner protection.
- Add Stop acting as this identity to the Control Plane.
- Add lifecycle audit events.

## 1.2.x - Human identity and separation of duties

- Add individual Operator and Owner credentials.
- Bind governed requests and decisions to human identities.
- Prevent self-approval of governed signing-key revocation.
- Add one-time human-token reveal hardening.
- Surface governed-decision policy failures in the Control Plane.

## 1.1.0 - Govern the governor

- Route signing-key trust revocation through the normal authorization and human-approval system.
- Preserve authorization lineage through governed execution.

## 1.0.0 - Emergency trust controls

- Add explicit signing-key revocation.
- Remove revoked keys from trusted JWKS output.
- Fail closed when configured signing material has been revoked.

## 0.9.0 - Signing key lifecycle

- Add active, retired, and revoked signing-key states.
- Preserve historical receipt verification across normal key rotation.

## 0.8.x - Signed portable receipts

- Add ES256 signing for authority receipts.
- Add JWKS public key distribution.
- Add offline signature verification and portable receipt export.

## 0.7.0 - Execution-time verification

- Add live verification of receipt state, agent, action, environment, scope, expiry, revocation, and delegation ancestry.

## 0.6.0 - Authority receipts and delegation

- Issue authority receipts after automatic or human-approved authorization.
- Add scoped delegation, expiry, and revocation.

## 0.5.0 - Authority primitives

- Expand the policy engine beyond a single monetary example.

For detailed development notes, see `docs/build-history.md`.
