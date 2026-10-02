interface Env {}

type Decision = "allow" | "deny" | "approval_required";

interface AuthorizeInput {
  agentId?: string;
  action?: string;
  amount?: number;
  currency?: string;
  context?: Record<string, unknown>;
}

interface AuthorizationResult {
  decision: Decision;
  policyId: string;
  reason: string;
  requestId: string;
  requiredApprover?: "manager" | "owner";
  createdAt: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS"
    }
  });

function evaluateRefund(input: AuthorizeInput): AuthorizationResult {
  const amount = input.amount;
  const requestId = `req_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return {
      decision: "deny",
      policyId: "refund-threshold-default",
      reason: "Refund amount must be a positive number.",
      requestId,
      createdAt
    };
  }

  if (amount < 100) {
    return {
      decision: "allow",
      policyId: "refund-threshold-default",
      reason: "Refund is below the $100 automatic authorization threshold.",
      requestId,
      createdAt
    };
  }

  if (amount <= 1000) {
    return {
      decision: "approval_required",
      policyId: "refund-threshold-default",
      reason: "Refunds from $100 through $1,000 require manager approval.",
      requestId,
      requiredApprover: "manager",
      createdAt
    };
  }

  return {
    decision: "approval_required",
    policyId: "refund-threshold-default",
    reason: "Refunds above $1,000 require owner approval.",
    requestId,
    requiredApprover: "owner",
    createdAt
  };
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true });

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "authority-layer-api", version: "0.1.0" });
    }

    if (request.method === "POST" && url.pathname === "/v1/authorize") {
      let input: AuthorizeInput;
      try {
        input = await request.json();
      } catch {
        return json({ error: "invalid_json" }, 400);
      }

      if (!input.agentId || !input.action) {
        return json({ error: "agentId_and_action_required" }, 400);
      }

      if (input.action !== "refund_customer") {
        return json({
          decision: "deny",
          policyId: "unsupported-action",
          reason: `Action '${input.action}' is not supported in v0.1.`,
          requestId: `req_${crypto.randomUUID()}`,
          createdAt: new Date().toISOString()
        });
      }

      return json(evaluateRefund(input));
    }

    return json({ error: "not_found" }, 404);
  }
};
