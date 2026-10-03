import fs from "node:fs";
import { test, expect } from "@playwright/test";

function readControlPlaneHtml() {
  const source = fs.readFileSync("apps/api/src/control-plane.ts", "utf8").trim();
  const prefix = "export const CONTROL_PLANE_HTML = ";
  return JSON.parse(source.slice(prefix.length, -1));
}

test("Control Plane unlocks and Receipts + Developer tabs render without browser errors", async ({ page }) => {
  const html = readControlPlaneHtml();
  const browserErrors = [];
  let expectGovernedDecision403 = false;

  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      expectGovernedDecision403 &&
      text.includes("Failed to load resource") &&
      text.includes("403")
    ) return;
    browserErrors.push(text);
  });

  await page.route("http://adnutum.test/**", async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/") {
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: html
      });
    }

    const token = request.headers()["x-control-plane-token"];
    if (token !== "ci-control-token") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "control_plane_unauthorized" })
      });
    }

    if (url.pathname === "/v1/requests") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requests: [{
            id: "req-ci",
            action: "refund_customer",
            decision: "approval_required",
            required_approver: "owner",
            reason: "CI request requires owner approval.",
            created_at: "2026-10-01T00:00:00.000Z",
            payload: { amount: 7500 },
            agent: { name: "finance-agent", external_key: "finance-agent" },
            approval_decisions: []
          }]
        })
      });
    }

    if (url.pathname === "/v1/requests/req-ci") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            id: "req-ci",
            action: "refund_customer",
            decision: "approval_required",
            required_approver: "owner",
            reason: "CI request requires owner approval.",
            created_at: "2026-10-01T00:00:00.000Z",
            payload: { amount: 7500 },
            agent: { name: "finance-agent", external_key: "finance-agent" },
            requester: { id: "human-operator-ci", name: "CI Operator", role: "operator" }
          },
          approvals: [],
          events: [
            {
              id: "event-ci-1",
              event_type: "authorization_evaluated",
              created_at: "2026-10-01T00:00:00.000Z"
            },
            {
              id: "event-ci-2",
              event_type: "approval_requested",
              created_at: "2026-10-01T00:00:01.000Z"
            }
          ]
        })
      });
    }

    if (
      url.pathname === "/v1/requests/req-ci/decision" &&
      request.method() === "POST"
    ) {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "owner_identity_required" })
      });
    }

    if (url.pathname === "/v1/agents") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          agents: [{
            id: "agent-ci",
            external_key: "finance-agent",
            name: "Finance Agent",
            created_at: "2026-10-01T00:00:00.000Z"
          }]
        })
      });
    }

    if (url.pathname === "/v1/receipts") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          receipts: [{
            id: "receipt-ci",
            project_id: "project-ci",
            authorization_request_id: "req-ci",
            parent_receipt_id: null,
            agent_id: "agent-ci",
            environment_id: "env-dev",
            action: "refund_customer",
            scope: { amount: 7500 },
            issued_by: "owner",
            issued_at: "2026-10-01T00:01:00.000Z",
            expires_at: "2099-10-01T00:16:00.000Z",
            revoked_at: null,
            state: "active",
            agent: { name: "Finance Agent", external_key: "finance-agent" },
            environment: { name: "Development", slug: "development" }
          }]
        })
      });
    }

    if (url.pathname === "/v1/developer/human-identities") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          identities: [
            {
              id: "human-operator-ci",
              name: "CI Operator",
              role: "operator",
              token_prefix: "adn_human_",
              last4: "op01",
              last_used_at: null,
              revoked_at: null,
              created_at: "2026-10-03T00:00:00.000Z"
            },
            {
              id: "human-owner-ci",
              name: "CI Owner",
              role: "owner",
              token_prefix: "adn_human_",
              last4: "ow01",
              last_used_at: null,
              revoked_at: null,
              created_at: "2026-10-03T00:00:01.000Z"
            }
          ]
        })
      });
    }

    if (url.pathname === "/v1/developer/environments") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          environments: [
            { id: "env-dev", name: "Development", slug: "development", is_default: true },
            { id: "env-stage", name: "Staging", slug: "staging", is_default: false },
            { id: "env-prod", name: "Production", slug: "production", is_default: false }
          ]
        })
      });
    }

    if (url.pathname === "/v1/developer/api-keys") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ apiKeys: [] })
      });
    }


    if (url.pathname === "/.well-known/jwks.json") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          keys: [{
            kty: "EC",
            crv: "P-256",
            x: "ci-x",
            y: "ci-y",
            use: "sig",
            alg: "ES256",
            kid: "adnutum-ci-key"
          }],
          keyLifecycle: [{
            kid: "adnutum-ci-key",
            status: "active",
            algorithm: "ES256",
            activatedAt: "2026-10-02T00:00:00.000Z",
            retiredAt: null
          }],
          revokedKeyIds: [],
          signingConfigured: true,
          activeKeyId: "adnutum-ci-key"
        })
      });
    }

    if (url.pathname === "/v1/developer/signing-keys") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          signingKeys: [{
            id: "adnutum-ci-key",
            public_jwk: { kty: "EC", crv: "P-256", x: "ci-x", y: "ci-y", use: "sig", alg: "ES256", kid: "adnutum-ci-key" },
            algorithm: "ES256",
            status: "active",
            activated_at: "2026-10-02T00:00:00.000Z",
            retired_at: null,
            revoked_at: null,
            revoked_by: null,
            revocation_reason: null
          }]
        })
      });
    }

    if (url.pathname === "/v1/developer/quickstart") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          install: "npm install @adnutum/sdk",
          example: {
            javascript: "const adnutum = new AdNutum({ baseUrl, apiKey });",
            action: "await adnutum.authorize({ action: 'refund_customer' });"
          }
        })
      });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_found" })
    });
  });

  await page.goto("http://adnutum.test/");

  await expect(page.locator("#tokenModal")).toBeVisible();
  await page.locator("#tokenInput").fill("ci-control-token");
  await page.locator("#unlockBtn").click();

  await expect(page.locator("#tokenModal")).toBeHidden();
  await expect(page.locator("#statRequests")).toHaveText("1");
  await page.locator("#recentRequests [data-open-request='req-ci']").click();
  expectGovernedDecision403 = true;
  await page.locator("#approveDetail").click();
  await expect(page.locator("#decisionError")).toHaveText(
    "Blocked: an Owner identity is required for this decision."
  );
  expectGovernedDecision403 = false;
  await page.locator("#closeDetail").click();
  await expect(page.locator("#statAgents")).toHaveText("1");

  await page.getByRole("button", { name: "Receipts" }).click();

  await expect(page.locator("#receipts")).toBeVisible();
  await expect(page.locator("#receiptList")).toContainText("refund_customer");
  await expect(page.locator("#receiptList")).toContainText("active");
  await expect(page.locator("#delegateReceiptBtn")).toBeVisible();

  await page.getByRole("button", { name: "Developer" }).click();

  await expect(page.locator("#developer")).toBeVisible();
  await expect(page.locator("#environmentList")).toContainText("Development");
  await expect(page.locator("#installCode")).toHaveText("npm install @adnutum/sdk");
  await expect(page.locator("#createKeyBtn")).toBeVisible();
  await expect(page.locator("#signingKeyList")).toContainText("adnutum-ci-key");
  await expect(page.locator("#signingKeyList")).toContainText("active");
  await expect(page.locator("#humanIdentityList")).toContainText("CI Operator");
  await expect(page.locator("#humanIdentityList")).toContainText("CI Owner");
  await expect(page.locator("#createHumanIdentityBtn")).toBeVisible();
  await expect(page.locator("#copyHumanIdentityTokenBtn")).toBeHidden();
  await expect(page.locator("#dismissHumanIdentityTokenBtn")).toBeHidden();
  await expect(page.locator("[data-revoke-signing-key='adnutum-ci-key']")).toBeVisible();
  await expect(page.locator("[data-revoke-signing-key='adnutum-ci-key']")).toHaveText("Request revocation");

  expect(browserErrors, browserErrors.join("\n")).toEqual([]);
});
