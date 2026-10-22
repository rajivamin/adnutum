# @adnutum/sdk

TypeScript client for **AD NŪTUM**, programmable authority for AI agents.

AD NŪTUM evaluates proposed agent actions and returns one of:

- `allow`
- `deny`
- `approval_required`

When authority is granted, AD NŪTUM can issue signed authority receipts that downstream systems can verify.

## Install

```bash
npm install @adnutum/sdk
```

## Quick start

```ts
import { AdNutum } from "@adnutum/sdk";

const adnutum = new AdNutum({
  baseUrl: process.env.ADNUTUM_BASE_URL!,
  apiKey: process.env.ADNUTUM_API_KEY!
});

const result = await adnutum.authorize({
  agentId: "marketing-agent",
  action: "increase_ad_budget",
  amount: 75,
  currency: "USD",
  context: {
    campaign: "Holiday launch"
  }
});

if (result.decision === "allow") {
  console.log("Authorized", result.receipt);
} else if (result.decision === "approval_required") {
  console.log("Awaiting human approval", result.requestId);
} else {
  console.log("Denied", result.reason);
}
```

## Resume after human approval

When `authorize()` returns `approval_required`, an external agent can safely poll the request without receiving Control Plane credentials:

```ts
const status = await adnutum.getAuthorizationStatus(result.requestId);

if (status.status === "authorized" && status.receipt) {
  console.log("Authority issued", status.receipt);
}
```

The status endpoint is scoped to the project and environment associated with the API key.

## Verify authority at execution time

```ts
const verification = await adnutum.verifyReceipt({
  receiptId: "receipt-id",
  agentId: "marketing-agent",
  action: "increase_ad_budget",
  amount: 75,
  currency: "USD",
  context: {
    campaign: "Holiday launch"
  }
});

if (!verification.valid) {
  throw new Error(`Authority invalid: ${verification.reason}`);
}
```

## Verify a signed receipt offline

```ts
import { verifySignedReceiptOffline } from "@adnutum/sdk";

const keys = await adnutum.getVerificationKeys();
const key = keys.keys.find(k => k.kid === receipt.signing_key_id);

if (!key) throw new Error("Verification key not found.");

const validSignature = await verifySignedReceiptOffline(receipt, key);
```

Offline verification proves signature authenticity and signed-payload integrity. Use live receipt verification when you also need current expiration, revocation, delegation, environment, agent, action, and scope checks.

## Core methods

- `authorize(input)`
- `getAuthorizationStatus(requestId)`
- `verifyReceipt(input)`
- `getVerificationKeys()`
- `getRequest(requestId)`
- `listReceipts()`
- `getReceipt(receiptId)`
- `delegateReceipt(receiptId, input)`
- `revokeReceipt(receiptId, input)`

Control-plane lifecycle methods are also available for operators using the appropriate administrative credentials.

## Requirements

- Node.js 18 or newer, or a modern runtime with `fetch` and Web Crypto.
- An AD NŪTUM API endpoint and API key.

## Security

Do not expose API keys, Control Plane tokens, human identity tokens, or private signing keys in client-side applications or source control.

See the repository security policy for vulnerability reporting.

## License

Apache-2.0.
