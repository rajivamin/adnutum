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

export interface AdNutumOptions {
  baseUrl: string;
  apiKey?: string;
  controlPlaneToken?: string;
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
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AD NŪTUM request failed: ${response.status} ${detail}`);
    }

    return response.json() as Promise<T>;
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
