import { CONTROL_PLANE_HTML } from "./control-plane";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  DEFAULT_PROJECT_ID: string;
  CONTROL_PLANE_TOKEN: string;
  SIGNING_PRIVATE_JWK?: string;
  SIGNING_KEY_ID?: string;
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
  requiredApprover?: "manager" | "owner" | "admin" | "editor" | "engineering_lead";
  createdAt: string;
  receipt?: Record<string, unknown> | null;
}

interface HumanDecisionInput {
  decision?: HumanDecision;
  decidedBy?: string;
  note?: string;
}

interface DelegateReceiptInput {
  delegateToAgentId?: string;
  expiresAt?: string;
  issuedBy?: string;
}

interface RevokeReceiptInput {
  revokedBy?: string;
  reason?: string;
}

interface VerifyReceiptInput {
  receiptId?: string;
  agentId?: string;
  action?: string;
  amount?: number;
  currency?: string;
  context?: Record<string, unknown>;
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

const ACTION_CATALOG = [
  {
    action: "refund_customer",
    category: "finance",
    summary: "Refund a customer payment",
    examples: ["$68 duplicate charge", "$2,400 lost shipment"]
  },
  {
    action: "increase_ad_budget",
    category: "marketing",
    summary: "Increase a campaign's daily ad budget",
    examples: ["+$75/day", "+$1,500/day"]
  },
  {
    action: "pay_invoice",
    category: "finance",
    summary: "Pay a vendor invoice",
    examples: ["$240 approved vendor", "$8,000 new vendor"]
  },
  {
    action: "publish_content",
    category: "publishing",
    summary: "Publish content to a public channel",
    examples: ["Routine social post", "Sensitive public statement"]
  },
  {
    action: "deploy_production",
    category: "engineering",
    summary: "Deploy software to production",
    examples: ["Release application build"]
  },
  {
    action: "delete_record",
    category: "data",
    summary: "Delete a data record",
    examples: ["Delete test record", "Delete production record"]
  }
] as const;

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

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).sort().map(key => JSON.stringify(key) + ":" + stableJson(obj[key])).join(",") + "}";
}

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function publicJwkFromPrivate(jwk: JsonWebKey, keyId?: string): JsonWebKey {
  return {
    kty: "EC",
    crv: "P-256",
    x: jwk.x,
    y: jwk.y,
    ext: true,
    key_ops: ["verify"],
    use: "sig",
    alg: "ES256",
    ...(keyId ? { kid: keyId } : {})
  };
}

async function signingMaterial(env: Env) {
  if (!env.SIGNING_PRIVATE_JWK) return null;

  let privateJwk: JsonWebKey;
  try {
    privateJwk = JSON.parse(env.SIGNING_PRIVATE_JWK) as JsonWebKey;
  } catch {
    throw new Error("SIGNING_PRIVATE_JWK is not valid JSON.");
  }

  if (privateJwk.kty !== "EC" || privateJwk.crv !== "P-256" || !privateJwk.d) {
    throw new Error("SIGNING_PRIVATE_JWK must be a P-256 EC private JWK.");
  }

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const keyId = env.SIGNING_KEY_ID?.trim() || "adnutum-v0.8-demo-key";
  return {
    privateKey,
    publicJwk: publicJwkFromPrivate(privateJwk, keyId),
    keyId
  };
}

async function signPayload(env: Env, payload: Record<string, unknown>) {
  const material = await signingMaterial(env);
  if (!material) return null;

  const bytes = new TextEncoder().encode(stableJson(payload));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    material.privateKey,
    bytes
  );

  return {
    signature: base64Url(new Uint8Array(signature)),
    signingKeyId: material.keyId,
    signatureAlgorithm: "ES256",
    publicJwk: material.publicJwk
  };
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


function contextBoolean(input: AuthorizeInput, key: string): boolean {
  return input.context?.[key] === true;
}

function contextString(input: AuthorizeInput, key: string): string {
  const value = input.context?.[key];
  return typeof value === "string" ? value : "";
}

function policyResult(
  decision: Decision,
  policyId: string,
  reason: string,
  requiredApprover?: AuthorizationResult["requiredApprover"]
): Omit<AuthorizationResult, "requestId"> {
  return {
    decision,
    policyId,
    reason,
    ...(requiredApprover ? { requiredApprover } : {}),
    createdAt: new Date().toISOString()
  };
}

function evaluateAdBudget(input: AuthorizeInput): Omit<AuthorizationResult, "requestId"> {
  const increase = input.amount;
  if (typeof increase !== "number" || !Number.isFinite(increase) || increase <= 0) {
    return policyResult("deny", "ad-budget-v1", "Ad budget increase must be a positive number.");
  }
  if (increase <= 100) {
    return policyResult("allow", "ad-budget-v1", "Ad budget increases of $100/day or less are automatically authorized.");
  }
  if (increase <= 1000) {
    return policyResult("approval_required", "ad-budget-v1", "Ad budget increases above $100/day through $1,000/day require manager approval.", "manager");
  }
  return policyResult("approval_required", "ad-budget-v1", "Ad budget increases above $1,000/day require owner approval.", "owner");
}

function evaluateInvoice(input: AuthorizeInput): Omit<AuthorizationResult, "requestId"> {
  const amount = input.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return policyResult("deny", "invoice-payment-v1", "Invoice amount must be a positive number.");
  }
  const vendorApproved = contextBoolean(input, "vendorApproved");
  if (!vendorApproved) {
    return policyResult("approval_required", "invoice-payment-v1", "Payments to vendors not on the approved vendor list require owner approval.", "owner");
  }
  if (amount < 500) {
    return policyResult("allow", "invoice-payment-v1", "Approved-vendor invoices below $500 are automatically authorized.");
  }
  if (amount <= 5000) {
    return policyResult("approval_required", "invoice-payment-v1", "Approved-vendor invoices from $500 through $5,000 require manager approval.", "manager");
  }
  return policyResult("approval_required", "invoice-payment-v1", "Approved-vendor invoices above $5,000 require owner approval.", "owner");
}

function evaluatePublishContent(input: AuthorizeInput): Omit<AuthorizationResult, "requestId"> {
  const sensitive = contextBoolean(input, "sensitive");
  const channel = contextString(input, "channel") || "public channel";
  if (sensitive) {
    return policyResult("approval_required", "publish-content-v1", `Sensitive content for ${channel} requires owner approval.`, "owner");
  }
  return policyResult("approval_required", "publish-content-v1", `Publishing to ${channel} requires editorial approval.`, "editor");
}

function evaluateProductionDeploy(): Omit<AuthorizationResult, "requestId"> {
  return policyResult("approval_required", "production-deploy-v1", "Production deployments require engineering lead approval.", "engineering_lead");
}

function evaluateDeleteRecord(input: AuthorizeInput): Omit<AuthorizationResult, "requestId"> {
  const scope = contextString(input, "scope").toLowerCase();
  if (scope === "production") {
    return policyResult("deny", "delete-record-v1", "Direct deletion of production records is prohibited by policy.");
  }
  return policyResult("approval_required", "delete-record-v1", "Deleting a non-production record requires admin approval.", "admin");
}

async function evaluateAction(
  env: Env,
  projectId: string,
  input: AuthorizeInput
): Promise<Omit<AuthorizationResult, "requestId">> {
  switch (input.action) {
    case "refund_customer":
      return evaluateRefund(input, await getRefundPolicy(env, projectId));
    case "increase_ad_budget":
      return evaluateAdBudget(input);
    case "pay_invoice":
      return evaluateInvoice(input);
    case "publish_content":
      return evaluatePublishContent(input);
    case "deploy_production":
      return evaluateProductionDeploy();
    case "delete_record":
      return evaluateDeleteRecord(input);
    default:
      return policyResult("deny", "unsupported-action", `Action '${input.action}' is not supported in v0.7.`);
  }
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
  requestId: string | null,
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

  let receipt: Record<string, unknown> | null = null;

  if (result.decision === "approval_required") {
    await addAuditEvent(env, auth.projectId, id, "approval_requested", {
      requiredApprover: result.requiredApprover
    });
  } else if (result.decision === "allow") {
    await addAuditEvent(env, auth.projectId, id, "authorization_issued");
    receipt = await issueAuthorityReceipt(env, {
      projectId: auth.projectId,
      requestId: id,
      agentId,
      environmentId: auth.environmentId,
      action: input.action!,
      scope: normalizeExecutionScope(input as unknown as Record<string, any>),
      issuedBy: "policy_engine"
    });
    await addAuditEvent(env, auth.projectId, id, "authority_receipt_issued", {
      receiptId: receipt.id,
      signed: Boolean(receipt.signature),
      signingKeyId: receipt.signing_key_id ?? null
    });
  } else {
    await addAuditEvent(env, auth.projectId, id, "action_blocked");
  }

  return { ...result, requestId: `req_${id}`, receipt };
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

  let receipt = null;
  if (input.decision === "approved") {
    const requestRow = existing.request as Record<string, any>;
    const payload = (requestRow.payload ?? {}) as Record<string, unknown>;
    receipt = await issueAuthorityReceipt(env, {
      projectId,
      requestId: id,
      agentId: String(requestRow.agent_id),
      environmentId: requestRow.environment_id ? String(requestRow.environment_id) : null,
      action: String(requestRow.action),
      scope: normalizeExecutionScope(payload as Record<string, any>),
      issuedBy: input.decidedBy?.trim() || "human"
    });
    await addAuditEvent(env, projectId, id, "authority_receipt_issued", { receiptId: receipt.id });
  }

  return { requestId: `req_${id}`, decision: input.decision, receipt, status: 200 };
}


function receiptExpiry(minutes = 15): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function issueAuthorityReceipt(
  env: Env,
  params: {
    projectId: string;
    requestId?: string | null;
    parentReceiptId?: string | null;
    agentId: string;
    environmentId?: string | null;
    action: string;
    scope: Record<string, unknown>;
    issuedBy: string;
    expiresAt?: string;
  }
) {
  const id = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const expiresAt = params.expiresAt ?? receiptExpiry(15);

  const signedPayload: Record<string, unknown> = {
    receiptId: id,
    projectId: params.projectId,
    authorizationRequestId: params.requestId ?? null,
    parentReceiptId: params.parentReceiptId ?? null,
    agentId: params.agentId,
    environmentId: params.environmentId ?? null,
    action: params.action,
    scope: params.scope,
    issuedBy: params.issuedBy,
    issuedAt,
    expiresAt
  };

  const signed = await signPayload(env, signedPayload);

  const created = await db<Array<Record<string, unknown>>>(env, "authority_receipts?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      project_id: params.projectId,
      authorization_request_id: params.requestId ?? null,
      parent_receipt_id: params.parentReceiptId ?? null,
      agent_id: params.agentId,
      environment_id: params.environmentId ?? null,
      action: params.action,
      scope: params.scope,
      issued_by: params.issuedBy,
      issued_at: issuedAt,
      expires_at: expiresAt,
      signed_payload: signed ? signedPayload : null,
      signature: signed?.signature ?? null,
      signing_key_id: signed?.signingKeyId ?? null,
      signature_algorithm: signed?.signatureAlgorithm ?? null
    })
  });

  if (!created[0]?.id) throw new Error("Authority receipt could not be created.");
  return created[0];
}

async function listReceipts(env: Env, projectId: string) {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    select: "*,agent:agents(external_key,name),environment:environments(name,slug),parent:authority_receipts!parent_receipt_id(id,action,expires_at)",
    order: "issued_at.desc",
    limit: "100"
  });
  return db<Array<Record<string, unknown>>>(env, `authority_receipts?${query.toString()}`);
}

async function getReceipt(env: Env, projectId: string, receiptId: string) {
  const query = new URLSearchParams({
    id: `eq.${receiptId}`,
    project_id: `eq.${projectId}`,
    select: "*,agent:agents(external_key,name),environment:environments(name,slug),parent:authority_receipts!parent_receipt_id(id,action,expires_at)",
    limit: "1"
  });
  const rows = await db<Array<Record<string, any>>>(env, `authority_receipts?${query.toString()}`);
  return rows[0] ?? null;
}

function normalizeInstant(value: unknown): string {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toISOString();
}

function expectedSignedReceiptPayload(receipt: Record<string, any>): Record<string, unknown> {
  return {
    receiptId: String(receipt.id),
    projectId: String(receipt.project_id),
    authorizationRequestId: receipt.authorization_request_id ? String(receipt.authorization_request_id) : null,
    parentReceiptId: receipt.parent_receipt_id ? String(receipt.parent_receipt_id) : null,
    agentId: String(receipt.agent_id),
    environmentId: receipt.environment_id ? String(receipt.environment_id) : null,
    action: String(receipt.action),
    scope: (receipt.scope ?? {}) as Record<string, unknown>,
    issuedBy: String(receipt.issued_by),
    issuedAt: normalizeInstant(receipt.issued_at),
    expiresAt: normalizeInstant(receipt.expires_at)
  };
}

async function verifyStoredReceiptSignature(env: Env, receipt: Record<string, any>): Promise<boolean> {
  if (!receipt.signature) return true;
  if (
    receipt.signature_algorithm !== "ES256" ||
    !receipt.signed_payload ||
    !receipt.signing_key_id
  ) return false;

  const material = await signingMaterial(env);
  if (!material) return false;
  if (receipt.signing_key_id !== material.keyId) return false;

  const expected = expectedSignedReceiptPayload(receipt);
  if (stableJson(expected) !== stableJson(receipt.signed_payload)) return false;

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    material.publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromBase64Url(String(receipt.signature)),
    new TextEncoder().encode(stableJson(receipt.signed_payload))
  );
}

function receiptState(receipt: Record<string, any>) {
  if (receipt.revoked_at) return "revoked";
  if (new Date(String(receipt.expires_at)).getTime() <= Date.now()) return "expired";
  return "active";
}


function normalizeExecutionScope(input: Record<string, any>): Record<string, unknown> {
  const scope: Record<string, unknown> = {};

  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    scope.amount = input.amount;
  }

  if (typeof input.currency === "string" && input.currency.trim()) {
    scope.currency = input.currency.trim().toUpperCase();
  }

  if (input.context && typeof input.context === "object" && !Array.isArray(input.context)) {
    const context: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.context)) {
      if (key === "reason") continue;
      context[key] = value;
    }
    if (Object.keys(context).length) scope.context = context;
  }

  return scope;
}

function receiptExecutionScope(receipt: Record<string, any>): Record<string, unknown> {
  const stored = (receipt.scope ?? {}) as Record<string, any>;

  // v0.6 stored the full authorize payload. v0.7 stores only material execution scope.
  if ("agentId" in stored || "action" in stored || "amount" in stored || "currency" in stored || "context" in stored) {
    return normalizeExecutionScope(stored);
  }

  return stored;
}

function deepEqualValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqualValue(value, b[index]));
  }
  if (
    a && b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aKeys = Object.keys(a as Record<string, unknown>).sort();
    const bKeys = Object.keys(b as Record<string, unknown>).sort();
    return aKeys.length === bKeys.length &&
      aKeys.every((key, index) =>
        key === bKeys[index] &&
        deepEqualValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
  }
  return false;
}

async function receiptChainIsActive(
  env: Env,
  projectId: string,
  receipt: Record<string, any>
): Promise<{ active: boolean; reason?: string }> {
  const visited = new Set<string>();
  let current: Record<string, any> | null = receipt;

  while (current) {
    const id = String(current.id);
    if (visited.has(id)) return { active: false, reason: "delegation_cycle_detected" };
    visited.add(id);

    const state = receiptState(current);
    if (state !== "active") {
      return {
        active: false,
        reason: current.id === receipt.id
          ? `receipt_${state}`
          : `parent_receipt_${state}`
      };
    }

    if (!current.parent_receipt_id) break;
    current = await getReceipt(env, projectId, String(current.parent_receipt_id));
    if (!current) return { active: false, reason: "parent_receipt_missing" };
  }

  return { active: true };
}

async function verifyAuthorityReceipt(
  env: Env,
  auth: AuthContext,
  input: VerifyReceiptInput
) {
  const deny = async (reason: string, receipt?: Record<string, any> | null) => {
    await addAuditEvent(env, auth.projectId, null, "authority_receipt_verification_failed", {
      receiptId: input.receiptId ?? null,
      agentId: input.agentId ?? null,
      action: input.action ?? null,
      environment: auth.environmentSlug,
      reason
    });
    return {
      valid: false,
      reason,
      receiptId: input.receiptId ?? null,
      state: receipt ? receiptState(receipt) : "unknown",
      verifiedAt: new Date().toISOString()
    };
  };

  if (!input.receiptId?.trim()) return deny("receiptId_required");
  if (!input.agentId?.trim()) return deny("agentId_required");
  if (!input.action?.trim()) return deny("action_required");

  const receipt = await getReceipt(env, auth.projectId, input.receiptId.trim());
  if (!receipt) return deny("receipt_not_found");

  if (receipt.signature && !(await verifyStoredReceiptSignature(env, receipt))) {
    return deny("signature_invalid", receipt);
  }

  const chain = await receiptChainIsActive(env, auth.projectId, receipt);
  if (!chain.active) return deny(chain.reason || "receipt_not_active", receipt);

  const holder = String(receipt.agent?.external_key || "");
  if (holder !== input.agentId.trim()) return deny("agent_mismatch", receipt);
  if (String(receipt.action) !== input.action.trim()) return deny("action_mismatch", receipt);

  const receiptEnvironmentId = receipt.environment_id ? String(receipt.environment_id) : null;
  if (receiptEnvironmentId !== auth.environmentId) return deny("environment_mismatch", receipt);

  const grantedScope = receiptExecutionScope(receipt);
  const requestedScope = normalizeExecutionScope(input as Record<string, any>);
  if (!deepEqualValue(grantedScope, requestedScope)) return deny("scope_mismatch", receipt);

  await addAuditEvent(env, auth.projectId, null, "authority_receipt_verified", {
    receiptId: receipt.id,
    agentId: input.agentId,
    action: input.action,
    environment: auth.environmentSlug
  });

  return {
    valid: true,
    reason: "authority_verified",
    receiptId: String(receipt.id),
    agentId: input.agentId.trim(),
    action: input.action.trim(),
    environment: auth.environmentSlug,
    scope: grantedScope,
    expiresAt: receipt.expires_at,
    delegated: Boolean(receipt.parent_receipt_id),
    verifiedAt: new Date().toISOString()
  };
}

async function delegateReceipt(
  env: Env,
  projectId: string,
  receiptId: string,
  input: DelegateReceiptInput
) {
  const parent = await getReceipt(env, projectId, receiptId);
  if (!parent) return { error: "receipt_not_found", status: 404 };
  if (receiptState(parent) !== "active") return { error: "receipt_not_active", status: 409 };
  if (!input.delegateToAgentId?.trim()) return { error: "delegateToAgentId_required", status: 400 };

  const delegateAgentId = await ensureAgent(env, projectId, input.delegateToAgentId.trim());
  const requestedExpiry = input.expiresAt ? new Date(input.expiresAt) : new Date(String(parent.expires_at));
  if (!Number.isFinite(requestedExpiry.getTime())) return { error: "invalid_expiresAt", status: 400 };

  const parentExpiry = new Date(String(parent.expires_at)).getTime();
  const childExpiry = Math.min(requestedExpiry.getTime(), parentExpiry);
  if (childExpiry <= Date.now()) return { error: "delegation_expiry_must_be_future", status: 400 };

  const child = await issueAuthorityReceipt(env, {
    projectId,
    parentReceiptId: String(parent.id),
    agentId: delegateAgentId,
    environmentId: parent.environment_id ? String(parent.environment_id) : null,
    action: String(parent.action),
    scope: (parent.scope ?? {}) as Record<string, unknown>,
    issuedBy: input.issuedBy?.trim() || String(parent.agent?.external_key || parent.issued_by || "delegator"),
    expiresAt: new Date(childExpiry).toISOString()
  });

  return { receipt: child, status: 201 };
}

async function revokeReceipt(
  env: Env,
  projectId: string,
  receiptId: string,
  input: RevokeReceiptInput
) {
  const existing = await getReceipt(env, projectId, receiptId);
  if (!existing) return { error: "receipt_not_found", status: 404 };
  if (existing.revoked_at) return { error: "receipt_already_revoked", status: 409 };

  const query = new URLSearchParams({ id: `eq.${receiptId}`, project_id: `eq.${projectId}` });
  await db(env, `authority_receipts?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      revoked_at: new Date().toISOString(),
      revoked_by: input.revokedBy?.trim() || "control-plane-owner",
      revocation_reason: input.reason?.trim() || "Revoked by operator."
    })
  });

  return { id: receiptId, revoked: true, status: 200 };
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
        version: "0.8.0",
        persistence: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.DEFAULT_PROJECT_ID),
        controlPlaneProtected: Boolean(env.CONTROL_PLANE_TOKEN),
        receiptSigningConfigured: Boolean(env.SIGNING_PRIVATE_JWK)
      });
    }

    if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
      const material = await signingMaterial(env);
      return json({
        keys: material ? [material.publicJwk] : [],
        signingConfigured: Boolean(material)
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

      if (request.method === "GET" && url.pathname === "/v1/actions") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        return json({ actions: ACTION_CATALOG });
      }

      if (request.method === "POST" && url.pathname === "/v1/authorize") {
        let input: AuthorizeInput;
        try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        if (!input.agentId || !input.action) return json({ error: "agentId_and_action_required" }, 400);

        const auth = await authorizeContext(request, env);
        if (!auth) return json({ error: "api_key_required" }, 401);

        const result = await evaluateAction(env, auth.projectId, input);
        return json(await persistAuthorization(env, auth, input, result));
      }

      if (request.method === "POST" && url.pathname === "/v1/verify") {
        let input: VerifyReceiptInput;
        try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

        const auth = await authorizeContext(request, env);
        if (!auth) return json({ error: "api_key_required" }, 401);

        return json(await verifyAuthorityReceipt(env, auth, input));
      }

      if (request.method === "GET" && url.pathname === "/v1/receipts") {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const receipts = await listReceipts(env, env.DEFAULT_PROJECT_ID);
        return json({
          receipts: receipts.map(r => ({ ...r, state: receiptState(r as Record<string, any>) }))
        });
      }

      const receiptMatch = url.pathname.match(/^\/v1\/receipts\/([^/]+)$/);
      if (request.method === "GET" && receiptMatch) {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        const receipt = await getReceipt(env, env.DEFAULT_PROJECT_ID, receiptMatch[1]);
        return receipt
          ? json({ receipt: { ...receipt, state: receiptState(receipt) } })
          : json({ error: "receipt_not_found" }, 404);
      }

      const delegateMatch = url.pathname.match(/^\/v1\/receipts\/([^/]+)\/delegate$/);
      if (request.method === "POST" && delegateMatch) {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        let input: DelegateReceiptInput;
        try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        const result = await delegateReceipt(env, env.DEFAULT_PROJECT_ID, delegateMatch[1], input);
        return json(result, "status" in result ? result.status : 200);
      }

      const revokeReceiptMatch = url.pathname.match(/^\/v1\/receipts\/([^/]+)\/revoke$/);
      if (request.method === "POST" && revokeReceiptMatch) {
        const denied = controlPlaneRequired(request, env);
        if (denied) return denied;
        let input: RevokeReceiptInput;
        try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        const result = await revokeReceipt(env, env.DEFAULT_PROJECT_ID, revokeReceiptMatch[1], input);
        return json(result, "status" in result ? result.status : 200);
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
