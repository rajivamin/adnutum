interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  DEFAULT_PROJECT_ID: string;
}

type Decision = "allow" | "deny" | "approval_required";
type HumanDecision = "approved" | "rejected";

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
  requestId?: string;
  requiredApprover?: "manager" | "owner";
  createdAt: string;
}

interface HumanDecisionInput {
  decision?: HumanDecision;
  decidedBy?: string;
  note?: string;
}

interface RefundPolicy {
  automaticBelow: number;
  managerThrough: number;
}

const DEFAULT_REFUND_POLICY: RefundPolicy = {
  automaticBelow: 100,
  managerThrough: 1000
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      "cache-control": "no-store"
    }
  });

function assertConfigured(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.DEFAULT_PROJECT_ID) {
    throw new Error("AD NŪTUM persistence is not configured.");
  }
}

async function db<T>(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  return (text ? JSON.parse(text) : null) as T;
}

async function getRefundPolicy(env: Env): Promise<{ id: string; rule: RefundPolicy }> {
  const query = new URLSearchParams({
    project_id: `eq.${env.DEFAULT_PROJECT_ID}`,
    action: "eq.refund_customer",
    is_active: "eq.true",
    select: "id,rule",
    limit: "1"
  });

  const existing = await db<Array<{ id: string; rule: Partial<RefundPolicy> }>>(
    env,
    `policies?${query.toString()}`
  );

  if (existing[0]?.id) {
    return {
      id: existing[0].id,
      rule: {
        automaticBelow: Number(existing[0].rule?.automaticBelow ?? DEFAULT_REFUND_POLICY.automaticBelow),
        managerThrough: Number(existing[0].rule?.managerThrough ?? DEFAULT_REFUND_POLICY.managerThrough)
      }
    };
  }

  const created = await db<Array<{ id: string; rule: RefundPolicy }>>(
    env,
    "policies?select=id,rule",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        project_id: env.DEFAULT_PROJECT_ID,
        name: "Refund threshold policy",
        action: "refund_customer",
        rule: DEFAULT_REFUND_POLICY,
        is_active: true
      })
    }
  );

  if (!created[0]?.id) throw new Error("Default refund policy could not be created.");
  return created[0];
}

async function updateRefundPolicy(env: Env, rule: RefundPolicy) {
  const current = await getRefundPolicy(env);
  const query = new URLSearchParams({ id: `eq.${current.id}` });

  await db(env, `policies?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ rule })
  });

  return { id: current.id, action: "refund_customer", rule };
}

function evaluateRefund(
  input: AuthorizeInput,
  policy: { id: string; rule: RefundPolicy }
): Omit<AuthorizationResult, "requestId"> {
  const amount = input.amount;
  const createdAt = new Date().toISOString();

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return {
      decision: "deny",
      policyId: policy.id,
      reason: "Refund amount must be a positive number.",
      createdAt
    };
  }

  if (amount < policy.rule.automaticBelow) {
    return {
      decision: "allow",
      policyId: policy.id,
      reason: `Refund is below the $${policy.rule.automaticBelow.toLocaleString()} automatic authorization threshold.`,
      createdAt
    };
  }

  if (amount <= policy.rule.managerThrough) {
    return {
      decision: "approval_required",
      policyId: policy.id,
      reason: `Refunds from $${policy.rule.automaticBelow.toLocaleString()} through $${policy.rule.managerThrough.toLocaleString()} require manager approval.`,
      requiredApprover: "manager",
      createdAt
    };
  }

  return {
    decision: "approval_required",
    policyId: policy.id,
    reason: `Refunds above $${policy.rule.managerThrough.toLocaleString()} require owner approval.`,
    requiredApprover: "owner",
    createdAt
  };
}

async function ensureAgent(env: Env, externalKey: string, name?: string): Promise<string> {
  const projectId = env.DEFAULT_PROJECT_ID;
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    external_key: `eq.${externalKey}`,
    select: "id",
    limit: "1"
  });

  const existing = await db<Array<{ id: string }>>(env, `agents?${query.toString()}`);
  if (existing[0]?.id) return existing[0].id;

  const created = await db<Array<{ id: string }>>(env, "agents?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      project_id: projectId,
      external_key: externalKey,
      name: name?.trim() || externalKey
    })
  });

  if (!created[0]?.id) throw new Error("Agent could not be created.");
  return created[0].id;
}

async function addAuditEvent(
  env: Env,
  requestId: string,
  eventType: string,
  data: Record<string, unknown> = {}
) {
  await db(env, "audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      project_id: env.DEFAULT_PROJECT_ID,
      authorization_request_id: requestId,
      event_type: eventType,
      data
    })
  });
}

function cleanRequestId(value: string): string {
  return value.startsWith("req_") ? value.slice(4) : value;
}

async function persistAuthorization(
  env: Env,
  input: AuthorizeInput,
  result: Omit<AuthorizationResult, "requestId">
): Promise<AuthorizationResult> {
  const agentId = await ensureAgent(env, input.agentId!);
  const id = crypto.randomUUID();

  await db(env, "authorization_requests", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id,
      project_id: env.DEFAULT_PROJECT_ID,
      agent_id: agentId,
      action: input.action,
      payload: input,
      decision: result.decision,
      policy_id: result.policyId,
      reason: result.reason,
      required_approver: result.requiredApprover ?? null
    })
  });

  await addAuditEvent(env, id, "authorization_evaluated", {
    decision: result.decision,
    policyId: result.policyId
  });

  if (result.decision === "approval_required") {
    await addAuditEvent(env, id, "approval_requested", {
      requiredApprover: result.requiredApprover
    });
  } else if (result.decision === "allow") {
    await addAuditEvent(env, id, "authorization_issued");
  } else {
    await addAuditEvent(env, id, "action_blocked");
  }

  return { ...result, requestId: `req_${id}` };
}

async function getRequest(env: Env, rawId: string) {
  const id = cleanRequestId(rawId);
  const requestQuery = new URLSearchParams({
    id: `eq.${id}`,
    project_id: `eq.${env.DEFAULT_PROJECT_ID}`,
    select: "*,agent:agents(external_key,name)",
    limit: "1"
  });
  const approvalQuery = new URLSearchParams({
    authorization_request_id: `eq.${id}`,
    select: "*",
    order: "created_at.asc"
  });
  const auditQuery = new URLSearchParams({
    authorization_request_id: `eq.${id}`,
    select: "*",
    order: "created_at.asc"
  });

  const [requests, approvals, events] = await Promise.all([
    db<Array<Record<string, unknown>>>(env, `authorization_requests?${requestQuery.toString()}`),
    db<Array<Record<string, unknown>>>(env, `approval_decisions?${approvalQuery.toString()}`),
    db<Array<Record<string, unknown>>>(env, `audit_events?${auditQuery.toString()}`)
  ]);

  if (!requests[0]) return null;
  return { request: requests[0], approvals, events };
}

async function listRequests(env: Env, limit: number) {
  const query = new URLSearchParams({
    project_id: `eq.${env.DEFAULT_PROJECT_ID}`,
    select: "*,agent:agents(external_key,name),approval_decisions(decision,decided_by,created_at)",
    order: "created_at.desc",
    limit: String(limit)
  });

  return db<Array<Record<string, unknown>>>(env, `authorization_requests?${query.toString()}`);
}

async function listAgents(env: Env) {
  const query = new URLSearchParams({
    project_id: `eq.${env.DEFAULT_PROJECT_ID}`,
    select: "id,external_key,name,created_at",
    order: "created_at.asc"
  });

  return db<Array<Record<string, unknown>>>(env, `agents?${query.toString()}`);
}

async function recordHumanDecision(
  env: Env,
  rawId: string,
  input: HumanDecisionInput
) {
  const id = cleanRequestId(rawId);
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { error: "decision_must_be_approved_or_rejected", status: 400 };
  }

  const existing = await getRequest(env, id);
  if (!existing) return { error: "request_not_found", status: 404 };

  if (existing.request.decision !== "approval_required") {
    return { error: "request_does_not_require_human_approval", status: 409 };
  }

  if (existing.approvals.length > 0) {
    return { error: "request_already_decided", status: 409 };
  }

  await db(env, "approval_decisions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      authorization_request_id: id,
      decided_by: input.decidedBy?.trim() || "human",
      decision: input.decision,
      note: input.note?.trim() || null
    })
  });

  await addAuditEvent(
    env,
    id,
    input.decision === "approved" ? "human_approved" : "human_rejected",
    { decidedBy: input.decidedBy?.trim() || "human" }
  );

  await addAuditEvent(
    env,
    id,
    input.decision === "approved" ? "authorization_issued" : "action_blocked"
  );

  return {
    requestId: `req_${id}`,
    decision: input.decision,
    status: 200
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true });

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "adnutum-api",
        version: "0.3.0",
        persistence: Boolean(
          env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.DEFAULT_PROJECT_ID
        )
      });
    }

    try {
      assertConfigured(env);

      if (request.method === "GET" && url.pathname === "/v1/requests") {
        const requested = Number(url.searchParams.get("limit") || 50);
        const limit = Math.max(1, Math.min(100, Number.isFinite(requested) ? requested : 50));
        return json({ requests: await listRequests(env, limit) });
      }

      if (request.method === "GET" && url.pathname === "/v1/agents") {
        return json({ agents: await listAgents(env) });
      }

      if (request.method === "POST" && url.pathname === "/v1/agents") {
        const input = await request.json() as { externalKey?: string; name?: string };
        if (!input.externalKey?.trim()) return json({ error: "externalKey_required" }, 400);
        const id = await ensureAgent(env, input.externalKey.trim(), input.name);
        return json({ id, externalKey: input.externalKey.trim(), name: input.name?.trim() || input.externalKey.trim() });
      }

      if (request.method === "GET" && url.pathname === "/v1/policies/refund_customer") {
        const policy = await getRefundPolicy(env);
        return json({ id: policy.id, action: "refund_customer", rule: policy.rule });
      }

      if (request.method === "PUT" && url.pathname === "/v1/policies/refund_customer") {
        const input = await request.json() as Partial<RefundPolicy>;
        const automaticBelow = Number(input.automaticBelow);
        const managerThrough = Number(input.managerThrough);

        if (
          !Number.isFinite(automaticBelow) ||
          !Number.isFinite(managerThrough) ||
          automaticBelow <= 0 ||
          managerThrough <= automaticBelow
        ) {
          return json({ error: "invalid_refund_thresholds" }, 400);
        }

        return json(await updateRefundPolicy(env, { automaticBelow, managerThrough }));
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

        const result =
          input.action === "refund_customer"
            ? evaluateRefund(input, await getRefundPolicy(env))
            : {
                decision: "deny" as const,
                policyId: "unsupported-action",
                reason: `Action '${input.action}' is not supported in v0.3.`,
                createdAt: new Date().toISOString()
              };

        return json(await persistAuthorization(env, input, result));
      }

      const requestMatch = url.pathname.match(/^\/v1\/requests\/([^/]+)$/);
      if (request.method === "GET" && requestMatch) {
        const result = await getRequest(env, requestMatch[1]);
        return result ? json(result) : json({ error: "request_not_found" }, 404);
      }

      const decisionMatch = url.pathname.match(/^\/v1\/requests\/([^/]+)\/decision$/);
      if (request.method === "POST" && decisionMatch) {
        let input: HumanDecisionInput;
        try {
          input = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const result = await recordHumanDecision(env, decisionMatch[1], input);
        const status = "status" in result ? result.status : 200;
        return json(result, status);
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return json({ error: "persistence_error", message }, 503);
    }
  }
};
