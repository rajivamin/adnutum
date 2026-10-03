export type AuthorizationDecision = "allow" | "deny" | "approval_required";
export type HumanDecision = "approved" | "rejected";

export type AdNutumAction =
  | "refund_customer"
  | "increase_ad_budget"
  | "pay_invoice"
  | "publish_content"
  | "deploy_production"
  | "delete_record";

export type RequiredApprover =
  | "manager"
  | "owner"
  | "admin"
  | "editor"
  | "engineering_lead";

export interface AuthorizeInput {
  agentId: string;
  action: AdNutumAction | (string & {});
  amount?: number;
  currency?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizeResult {
  decision: AuthorizationDecision;
  policyId: string;
  reason: string;
  requestId: string;
  requiredApprover?: RequiredApprover;
  createdAt: string;
  receipt?: AuthorityReceipt | null;
}

export interface HumanDecisionInput {
  decision: HumanDecision;
  decidedBy?: string;
  note?: string;
}

export interface AuthorityReceipt {
  id: string;
  project_id: string;
  authorization_request_id?: string | null;
  parent_receipt_id?: string | null;
  agent_id: string;
  environment_id?: string | null;
  action: string;
  scope: Record<string, unknown>;
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at?: string | null;
  revoked_by?: string | null;
  revocation_reason?: string | null;
  signed_payload?: Record<string, unknown> | null;
  signature?: string | null;
  signing_key_id?: string | null;
  signature_algorithm?: string | null;
  state?: "active" | "expired" | "revoked";
}

export interface DelegateReceiptInput {
  delegateToAgentId: string;
  expiresAt?: string;
  issuedBy?: string;
}

export interface RevokeReceiptInput {
  revokedBy?: string;
  reason?: string;
}

export interface VerifyReceiptInput {
  receiptId: string;
  agentId: string;
  action: string;
  amount?: number;
  currency?: string;
  context?: Record<string, unknown>;
}

export interface VerifyReceiptResult {
  valid: boolean;
  reason: string;
  receiptId?: string | null;
  agentId?: string;
  action?: string;
  environment?: string;
  scope?: Record<string, unknown>;
  expiresAt?: string;
  delegated?: boolean;
  verifiedAt: string;
}

export interface VerificationKeyLifecycle {
  kid: string;
  status: "active" | "retired" | "revoked";
  algorithm: string;
  activatedAt: string;
  retiredAt?: string | null;
}

export interface SigningKeyRecord {
  id: string;
  public_jwk: JsonWebKey;
  algorithm: string;
  status: "active" | "retired" | "revoked";
  activated_at: string;
  retired_at?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
  revocation_reason?: string | null;
}

export interface VerificationKeySet {
  keys: JsonWebKey[];
  keyLifecycle: VerificationKeyLifecycle[];
  revokedKeyIds: string[];
  signingConfigured: boolean;
  signingOperational?: boolean;
  activeKeyId?: string | null;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).sort().map(key => JSON.stringify(key) + ":" + stableJson(obj[key])).join(",") + "}";
}

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

export async function verifySignedReceiptOffline(
  receipt: AuthorityReceipt,
  publicJwk: JsonWebKey
): Promise<boolean> {
  if (!receipt.signed_payload || !receipt.signature || receipt.signature_algorithm !== "ES256") {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(receipt.signature),
    new TextEncoder().encode(stableJson(receipt.signed_payload))
  );
}

export interface HumanIdentity {
  id: string;
  projectId: string;
  name: string;
  role: "operator" | "owner";
}

export interface HumanIdentityRecord {
  id: string;
  name: string;
  role: "operator" | "owner";
  token_prefix: string;
  last4: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
}

export interface AdNutumOptions {
  baseUrl: string;
  apiKey?: string;
  controlPlaneToken?: string;
  controlPlaneIdentityToken?: string;
}

export class AdNutum {
  constructor(private readonly options: AdNutumOptions) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        ...(this.options.controlPlaneToken ? { "x-control-plane-token": this.options.controlPlaneToken } : {}),
        ...(this.options.controlPlaneIdentityToken
          ? { "x-control-plane-identity-token": this.options.controlPlaneIdentityToken }
          : {}),
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AD NŪTUM request failed: ${response.status} ${detail}`);
    }

    return response.json() as Promise<T>;
  }

  async getVerificationKeys(): Promise<VerificationKeySet> {
    return this.request<VerificationKeySet>("/.well-known/jwks.json");
  }

  async listSigningKeys() {
    return this.request<{ signingKeys: SigningKeyRecord[] }>("/v1/developer/signing-keys");
  }

  async listHumanIdentities() {
    return this.request<{ identities: HumanIdentityRecord[] }>("/v1/developer/human-identities");
  }

  async getActingHumanIdentity() {
    return this.request<{ identity: HumanIdentity }>("/v1/developer/human-identities/me");
  }

  async createHumanIdentity(name: string, role: "operator" | "owner") {
    return this.request<{ identity: HumanIdentityRecord; token: string }>("/v1/developer/human-identities", {
      method: "POST",
      body: JSON.stringify({ name, role })
    });
  }

  async requestSigningKeyRevocation(
    keyId: string,
    reason: string,
    requestedBy = "control-plane-operator"
  ) {
    return this.request<AuthorizeResult>(
      `/v1/developer/signing-keys/${encodeURIComponent(keyId)}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({ reason, requestedBy })
      }
    );
  }

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    return this.request<AuthorizeResult>("/v1/authorize", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async decide(requestId: string, input: HumanDecisionInput) {
    return this.request<{ requestId: string; decision: HumanDecision }>(
      `/v1/requests/${encodeURIComponent(requestId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
  }

  async verifyReceipt(input: VerifyReceiptInput) {
    return this.request<VerifyReceiptResult>("/v1/verify", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async listReceipts() {
    return this.request<{ receipts: AuthorityReceipt[] }>("/v1/receipts");
  }

  async getReceipt(receiptId: string) {
    return this.request<{ receipt: AuthorityReceipt }>(
      `/v1/receipts/${encodeURIComponent(receiptId)}`
    );
  }

  async delegateReceipt(receiptId: string, input: DelegateReceiptInput) {
    return this.request<{ receipt: AuthorityReceipt }>(
      `/v1/receipts/${encodeURIComponent(receiptId)}/delegate`,
      { method: "POST", body: JSON.stringify(input) }
    );
  }

  async revokeReceipt(receiptId: string, input: RevokeReceiptInput = {}) {
    return this.request<{ id: string; revoked: boolean }>(
      `/v1/receipts/${encodeURIComponent(receiptId)}/revoke`,
      { method: "POST", body: JSON.stringify(input) }
    );
  }

  async getRequest(requestId: string) {
    return this.request<{
      request: Record<string, unknown>;
      approvals: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
    }>(`/v1/requests/${encodeURIComponent(requestId)}`);
  }
}
