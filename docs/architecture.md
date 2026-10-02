# Architecture Notes

## Thesis

AI reasoning and organizational authority are different things.

A model may correctly determine what action would achieve a goal while still lacking authority to perform that action. AD NŪTUM creates a programmable boundary between an agent's proposed action and its execution.

## v0.1 flow

Agent / application
    ↓
SDK or REST request
    ↓
Policy evaluation
    ↓
allow | deny | approval_required
    ↓
Human decision when required
    ↓
Audit event

## Initial policy dimensions

The first release supports a narrow monetary threshold policy. The model is intentionally designed to expand later to:

- monetary authority
- communication authority
- publishing authority
- destructive actions
- time windows
- agent identity
- environment (development / staging / production)
- confidence thresholds
- multi-approver rules

## Product boundary

The public SDK should remain small and easy to inspect. The hosted control plane will own policies, approval workflows, audit history, identities, environments, API keys, analytics and billing.
