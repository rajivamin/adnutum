export type AuthorizationDecision = "allow" | "deny" | "approval_required";

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
}

export interface AdNutumOptions {
  baseUrl: string;
  apiKey?: string;
}

export class AdNutum {
  constructor(private readonly options: AdNutumOptions) {}

  async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/v1/authorize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {})
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`AD NŪTUM request failed: ${response.status}`);
    }

    return response.json() as Promise<AuthorizeResult>;
  }
}
