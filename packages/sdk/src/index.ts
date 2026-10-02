export type AuthorizationDecision = "allow" | "deny" | "approval_required";
export type HumanDecision = "approved" | "rejected";

export interface AuthorizeInput {
  agentId: string;
  action: string;
  amount?: number;
  currency?: string;
  context?: Record<string, unknown>;
}

export interface AuthorizeResult {
  decision: AuthorizationDecision;
  policyId: string;
  reason: string;
  requestId: string;
  requiredApprover?: "manager" | "owner";
  createdAt: string;
}

export interface HumanDecisionInput {
  decision: HumanDecision;
  decidedBy?: string;
  note?: string;
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

  async getRequest(requestId: string) {
    return this.request<{
      request: Record<string, unknown>;
      approvals: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
    }>(`/v1/requests/${encodeURIComponent(requestId)}`);
  }
}
