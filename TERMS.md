# AD NŪTUM Product Terms

**Effective date:** October 22, 2026

These Product Terms govern use of the hosted AD NŪTUM service maintained by Rumble Flea Studios. The open-source SDK and source code are separately licensed under Apache-2.0.

By using the hosted service, you agree to these terms.

## 1. Service

AD NŪTUM provides programmable authorization infrastructure for AI agents and applications. The service can evaluate proposed actions, require human approval, issue authority receipts, and verify whether previously issued authority remains valid.

AD NŪTUM does not itself guarantee that a downstream action is lawful, safe, accurate, appropriate, or successfully executed.

## 2. Your responsibilities

You are responsible for:

- deciding which actions your agents may request;
- defining policies appropriate for your risk model;
- protecting API keys, Control Plane credentials, human identity tokens, and other secrets;
- maintaining appropriate application authentication, identity proofing, fraud controls, and endpoint security;
- obtaining any permissions or notices required for data you submit;
- complying with applicable laws and third-party platform terms; and
- independently validating consequential downstream actions.

Do not submit secrets, payment-card data, government identifiers, health records, or other sensitive personal information unless an approved deployment expressly supports that data and you have a lawful basis to process it.

## 3. Acceptable use

You may not use AD NŪTUM to:

- bypass authentication, permissions, safety controls, or human approval requirements;
- conceal the nature or consequences of an action from a user;
- perform unlawful, deceptive, abusive, or unauthorized activity;
- probe, disrupt, overload, or compromise the service;
- forge, tamper with, or misrepresent authority receipts;
- use credentials belonging to another project or user without authorization; or
- represent that AD NŪTUM, Rumble Flea Studios, Meta, or another platform has approved an action when it has not.

## 4. AI-agent and connector behavior

An AI agent's reasoning is not authority. Integrations must treat an AD NŪTUM authorization decision or receipt according to its documented scope, environment, expiration, and revocation state.

Where a platform such as Muse requires its own user approval, AD NŪTUM does not replace that approval. Integrators must respect both the platform's approval controls and AD NŪTUM's application-level authorization controls.

A receipt should be verified immediately before a consequential action when current state matters.

## 5. Beta availability

The hosted service may be offered as a beta. Features, limits, endpoints, and availability may change. We may suspend access to protect the service, users, infrastructure, or third parties.

Unless separately agreed in writing, no service-level agreement or guaranteed uptime applies.

## 6. Fees

The public SDK is available under Apache-2.0. Hosted-service pricing, if introduced, will be disclosed before charges apply. AD NŪTUM does not currently make a user's downstream payment merely because it evaluates a payment-related authorization policy.

## 7. Intellectual property

The AD NŪTUM source code and SDK are governed by their applicable open-source license. Product names, trademarks, hosted-service infrastructure, credentials, and non-open-source materials are not licensed except as needed to use the service.

You retain rights in the data and configuration you provide, subject to the permissions needed to operate, secure, support, and improve the service.

## 8. Privacy and data handling

Use of the hosted service is subject to the [Privacy Notice](./PRIVACY.md) and [Data Handling](./docs/data-handling.md) documentation.

## 9. Security

You must promptly revoke or rotate credentials that you reasonably believe are compromised.

Security vulnerabilities should be reported privately as described in [SECURITY.md](./SECURITY.md).

## 10. Disclaimers

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE HOSTED SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION.

AD NŪTUM IS AUTHORIZATION INFRASTRUCTURE. IT IS NOT LEGAL, MEDICAL, FINANCIAL, IDENTITY, FRAUD, PAYMENT, OR CYBERSECURITY ADVICE.

## 11. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, RUMBLE FLEA STUDIOS AND AD NŪTUM CONTRIBUTORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITY ARISING FROM USE OF THE HOSTED SERVICE.

Any liability that cannot lawfully be excluded will be limited to the minimum amount permitted by applicable law.

## 12. Termination

You may stop using the hosted service at any time. Access may be suspended or terminated for security risk, abuse, material violation of these terms, legal requirements, or discontinuation of the beta.

Data remaining after termination is handled under the Privacy Notice and applicable data-handling requirements.

## 13. Changes

These terms may be updated as the service develops. Material changes will be reflected by updating the effective date in the public repository.

## 14. Contact

Questions about these Product Terms may be sent to **dev@rumblefleastudios.com**.

> These beta Product Terms are operational documentation and are not a substitute for legal advice. They should be reviewed by qualified counsel before broad commercial deployment.
