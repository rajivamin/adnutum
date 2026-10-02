import { CONTROL_PLANE_HTML } from "./control-plane";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  DEFAULT_PROJECT_ID: string;
  CONTROL_PLANE_TOKEN: string;
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

interface AuthContext {
  projectId: string;
  environmentId: string | null;
  environmentSlug: string;
  source: "control_plane" | "api_key";
  apiKeyId?: string;
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
      "access-control-allow-headers": "content-type, authorization, x-control-plane-token",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "cache-control": "no-store"
    }
  });

function assertConfigured(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.DEFAULT_PROJECT_ID) {
    throw new Error("AD NŪTUM persistence is not configured.");
  }
}

function isControlPlaneAuthorized(request: Request, env: Env): boolean {
  const supplied = request.headers.get("x-control-plane-token");
  return Boolean(env.CONTROL_PLANE_TOKEN && supplied && supplied === env.CONTROL_PLANE_TOKEN);
}

function controlPlaneRequired(request: Request, env: Env): Response | null {
  return isControlPlaneAuthorized(request, env)
    ? null
    : json({ error: "control_plane_unauthorized" }, 401);
}

async function db<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
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
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 24): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function ensureDefaultEnvironments(env: Env, projectId: string) {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    select: "id,name,slug,is_default,created_at",
    order: "created_at.asc"
  });
  let environments = await db<Array<Record<string, unknown>>>(env, `environments?${query.toString()}`);
  const existing = new Set(environments.map(x => String(x.slug)));

  const defaults = [
    { name: "Development", slug: "development", is_default: true },
    { name: "Staging", slug: "staging", is_default: false },
    { name: "Production", slug: "production", is_default: false }
  ];

  const missing = defaults.filter(x => !existing.has(x.slug));
  if (missing.length) {
    await db(env, "environments", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(missing.map(x => ({ ...x, project_id: projectId })))
    });
    environments = await db<Array<Record<string, unknown>>>(env, `environments?${query.toString()}`);
  }

  return environments;
}

async function defaultEnvironment(env: Env, projectId: string) {
  const environments = await ensureDefaultEnvironments(env, projectId);
  return environments.find(x => x.is_default) ?? environments[0] ?? null;
}

async function authenticateApiKey(request: Request, env: Env): Promise<AuthContext | null> {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const raw = header.slice(7).trim();
  if (!raw.startsWith("adn_")) return null;

  const keyHash = await sha256(raw);
  const query = new URLSearchParams({
    key_hash: `eq.${keyHash}`,
    revoked_at: "is.null",
    select: "id,project_id,environment_id,environment:environments(slug)",
    limit: "1"
  });
  const rows = await db<Array<Record<string, any>>>(env, `api_keys?${query.toString()}`);
  const row = rows[0];
  if (!row) return null;

  const used = new URLSearchParams({ id: `eq.${row.id}` });
  await db(env, `api_keys?${used.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_used_at: new Date().toISOString() })
  });

  return {
    projectId: row.project_id,
    environmentId: row.environment_id,
    environmentSlug: row.environment?.slug || "unknown",
    source: "api_key",
    apiKeyId: row.id
  };
}

async function authorizeContext(request: Request, env: Env): Promise<AuthContext | null> {
  if (isControlPlaneAuthorized(request, env)) {
    const environment = await defaultEnvironment(env, env.DEFAULT_PROJECT_ID);
    return {
      projectId: env.DEFAULT_PROJECT_ID,
      environmentId: environment ? String(environment.id) : null,
      environmentSlug: environment ? String(environment.slug) : "development",
      source: "control_plane"
    };
  }
  return authenticateApiKey(request, env);
}

async function getRefundPolicy(env: Env, projectId: string): Promise<{ id: string; rule: RefundPolicy }> {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
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

  const created = await db<Array<{ id: string; rule: RefundPolicy }>>(env, "policies?select=id,rule", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      project_id: projectId,
      name: "Refund threshold policy",
      action: "refund_customer",
      rule: DEFAULT_REFUND_POLICY,
      is_active: true
    })
  });

  if (!created[0]?.id) throw new Error("Default refund policy could not be created.");
  return created[0];
}

async function updateRefundPolicy(env: Env, projectId: string, rule: RefundPolicy) {
  const current = await getRefundPolicy(env, projectId);
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

async function ensureAgent(
  env: Env,
  projectId: string,
  externalKey: string,
  name?: string
): Promise<string> {
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
  projectId: string,
  requestId: string,
  eventType: string,
  data: Record<string, unknown> = {}
) {
  await db(env, "audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      project_id: projectId,
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
  auth: AuthContext,
  input: AuthorizeInput,
  result: Omit<AuthorizationResult, "requestId">
): Promise<AuthorizationResult> {
  const agentId = await ensureAgent(env, auth.projectId, input.agentId!);
  const id = crypto.randomUUID();

  await db(env, "authorization_requests", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id,
      project_id: auth.projectId,
      environment_id: auth.environmentId,
      agent_id: agentId,
      action: input.action,
      payload: input,
      decision: result.decision,
      policy_id: result.policyId,
      reason: result.reason,
      required_approver: result.requiredApprover ?? null
    })
  });

  await addAuditEvent(env, auth.projectId, id, "authorization_evaluated", {
    decision: result.decision,
    policyId: result.policyId,
    environment: auth.environmentSlug,
    authSource: auth.source
  });

  if (result.decision === "approval_required") {
    await addAuditEvent(env, auth.projectId, id, "approval_requested", {
      requiredApprover: result.requiredApprover
    });
  } else if (result.decision === "allow") {
    await addAuditEvent(env, auth.projectId, id, "authorization_issued");
  } else {
    await addAuditEvent(env, auth.projectId, id, "action_blocked");
  }

  return { ...result, requestId: `req_${id}` };
}

async function getRequest(env: Env, projectId: string, rawId: string) {
  const id = cleanRequestId(rawId);
  const requestQuery = new URLSearchParams({
    id: `eq.${id}`,
    project_id: `eq.${projectId}`,
    select: "*,agent:agents(external_key,name),environment:environments(name,slug)",
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

async function listRequests(env: Env, projectId: string, limit: number) {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    select: "*,agent:agents(external_key,name),environment:environments(name,slug),approval_decisions(decision,decided_by,created_at)",
    order: "created_at.desc",
    limit: String(limit)
  });
  return db<Array<Record<string, unknown>>>(env, `authorization_requests?${query.toString()}`);
}

async function listAgents(env: Env, projectId: string) {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    select: "id,external_key,name,created_at",
    order: "created_at.asc"
  });
  return db<Array<Record<string, unknown>>>(env, `agents?${query.toString()}`);
}

async function recordHumanDecision(
  env: Env,
  projectId: string,
  rawId: string,
  input: HumanDecisionInput
) {
  const id = cleanRequestId(rawId);
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { error: "decision_must_be_approved_or_rejected", status: 400 };
  }

  const existing = await getRequest(env, projectId, id);
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
    projectId,
    id,
    input.decision === "approved" ? "human_approved" : "human_rejected",
    { decidedBy: input.decidedBy?.trim() || "human" }
  );

  await addAuditEvent(
    env,
    projectId,
    id,
    input.decision === "approved" ? "authorization_issued" : "action_blocked"
  );

  return { requestId: `req_${id}`, decision: input.decision, status: 200 };
}

async function listApiKeys(env: Env, projectId: string) {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    select: "id,name,key_prefix,last4,last_used_at,revoked_at,created_at,environment:environments(id,name,slug)",
    order: "created_at.desc"
  });
  return db<Array<Record<string, unknown>>>(env, `api_keys?${query.toString()}`);
}

async function createApiKey(env: Env, projectId: string, environmentId: string, name: string) {
  const envQuery = new URLSearchParams({
    id: `eq.${environmentId}`,
    project_id: `eq.${projectId}`,
    select: "id,slug",
    limit: "1"
  });
  const envRows = await db<Array<{ id: string; slug: string }>>(env, `environments?${envQuery.toString()}`);
  const target = envRows[0];
  if (!target) throw new Error("Environment not found.");

  const prefix = target.slug === "production" ? "adn_live_" : target.slug === "staging" ? "adn_stage_" : "adn_dev_";
  const rawKey = prefix + randomToken(28);
  const hash = await sha256(rawKey);

  const created = await db<Array<{ id: string }>>(env, "api_keys?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      project_id: projectId,
      environment_id: target.id,
      name: name || "Developer key",
      key_prefix: prefix,
      key_hash: hash,
      last4: rawKey.slice(-4)
    })
  });

  return { id: created[0]?.id, key: rawKey, last4: rawKey.slice(-4), prefix, environment: target.slug };
}

async function revokeApiKey(env: Env, projectId: string, keyId: string) {
  const query = new URLSearchParams({ id: `eq.${keyId}`, project_id: `eq.${projectId}` });
  await db(env, `api_keys?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ revoked_at: new Date().toISOString() })
  });
  return { id: keyId, revoked: true };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ ok: true });

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(CONTROL_PLANE_HTML, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "adnutum-api",
        version: "0.4.0",
        persistence: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.DEFAULT_PROJECT_ID),
        controlPlaneProtected: Boolean(env.CONTROL_PLANE_TOKEN)
      });
    }

    try {
      assertConfigured(env);

      if (url.pathname.startsWith("/v1/developer/")) {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const projectId = env.DEFAULT_PROJECT_ID;

        if (request.method === "GET" && url.pathname === "/v1/developer/environments") {
          return json({ environments: await ensureDefaultEnvironments(env, projectId) });
        }

        if (request.method === "GET" && url.pathname === "/v1/developer/api-keys") {
          return json({ apiKeys: await listApiKeys(env, projectId) });
        }

        if (request.method === "POST" && url.pathname === "/v1/developer/api-keys") {
          const input = await request.json() as { environmentId?: string; name?: string };
          if (!input.environmentId) return json({ error: "environmentId_required" }, 400);
          return json(await createApiKey(env, projectId, input.environmentId, input.name?.trim() || "Developer key"), 201);
        }

        const revoke = url.pathname.match(/^\/v1\/developer\/api-keys\/([^/]+)$/);
        if (request.method === "DELETE" && revoke) {
          return json(await revokeApiKey(env, projectId, revoke[1]));
        }

        if (request.method === "GET" && url.pathname === "/v1/developer/quickstart") {
          const environments = await ensureDefaultEnvironments(env, projectId);
          return json({
            baseUrl: url.origin,
            environments,
            install: "npm install @adnutum/sdk",
            example: {
              javascript: `const adnutum = new AdNutum({ baseUrl: "${url.origin}", apiKey: process.env.ADNUTUM_API_KEY });`,
              action: `await adnutum.authorize({ agentId: "finance-agent", action: "refund_customer", amount: 4800, currency: "USD" });`
            }
          });
        }
      }

      if (request.method === "GET" && url.pathname === "/v1/requests") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const requested = Number(url.searchParams.get("limit") || 50);
        const limit = Math.max(1, Math.min(100, Number.isFinite(requested) ? requested : 50));
        return json({ requests: await listRequests(env, env.DEFAULT_PROJECT_ID, limit) });
      }

      if (request.method === "GET" && url.pathname === "/v1/agents") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        return json({ agents: await listAgents(env, env.DEFAULT_PROJECT_ID) });
      }

      if (request.method === "POST" && url.pathname === "/v1/agents") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const input = await request.json() as { externalKey?: string; name?: string };
        if (!input.externalKey?.trim()) return json({ error: "externalKey_required" }, 400);
        const id = await ensureAgent(env, env.DEFAULT_PROJECT_ID, input.externalKey.trim(), input.name);
        return json({ id, externalKey: input.externalKey.trim(), name: input.name?.trim() || input.externalKey.trim() });
      }

      if (request.method === "GET" && url.pathname === "/v1/policies/refund_customer") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const policy = await getRefundPolicy(env, env.DEFAULT_PROJECT_ID);
        return json({ id: policy.id, action: "refund_customer", rule: policy.rule });
      }

      if (request.method === "PUT" && url.pathname === "/v1/policies/refund_customer") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const input = await request.json() as Partial<RefundPolicy>;
        const automaticBelow = Number(input.automaticBelow);
        const managerThrough = Number(input.managerThrough);
        if (!Number.isFinite(automaticBelow) || !Number.isFinite(managerThrough) || automaticBelow <= 0 || managerThrough <= automaticBelow) {
          return json({ error: "invalid_refund_thresholds" }, 400);
        }
        return json(await updateRefundPolicy(env, env.DEFAULT_PROJECT_ID, { automaticBelow, managerThrough }));
      }

      if (request.method === "POST" && url.pathname === "/v1/authorize") {
        let input: AuthorizeInput;
        try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        if (!input.agentId || !input.action) return json({ error: "agentId_and_action_required" }, 400);

        const auth = await authorizeContext(request, env);
        if (!auth) return json({ error: "api_key_required" }, 401);

        const result =
          input.action === "refund_customer"
            ? evaluateRefund(input, await getRefundPolicy(env, auth.projectId))
            : {
                decision: "deny" as const,
                policyId: "unsupported-action",
                reason: `Action '${input.action}' is not supported in v0.4.`,
                createdAt: new Date().toISOString()
              };

        return json(await persistAuthorization(env, auth, input, result));
      }

      const requestMatch = url.pathname.match(/^\/v1\/requests\/([^/]+)$/);
      if (request.method === "GET" && requestMatch) {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const result = await getRequest(env, env.DEFAULT_PROJECT_ID, requestMatch[1]);
        return result ? json(result) : json({ error: "request_not_found" }, 404);
      }

      const decisionMatch = url.pathname.match(/^\/v1\/requests\/([^/]+)\/decision$/);
      if (request.method === "POST" && decisionMatch) {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        let input: HumanDecisionInput;
        try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        const result = await recordHumanDecision(env, env.DEFAULT_PROJECT_ID, decisionMatch[1], input);
        return json(result, "status" in result ? result.status : 200);
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      return json({ error: "persistence_error", message }, 503);
    }
  }
};
