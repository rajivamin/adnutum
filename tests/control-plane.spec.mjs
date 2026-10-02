import fs from "node:fs";
import { test, expect } from "@playwright/test";

function readControlPlaneHtml() {
  const source = fs.readFileSync("apps/api/src/control-plane.ts", "utf8").trim();
  const prefix = "export const CONTROL_PLANE_HTML = ";
  return JSON.parse(source.slice(prefix.length, -1));
}

test("Control Plane unlocks and Developer tab renders without browser errors", async ({ page }) => {
  const html = readControlPlaneHtml();
  const browserErrors = [];

  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
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
  await expect(page.locator("#statAgents")).toHaveText("1");

  await page.getByRole("button", { name: "Developer" }).click();

  await expect(page.locator("#developer")).toBeVisible();
  await expect(page.locator("#environmentList")).toContainText("Development");
  await expect(page.locator("#installCode")).toHaveText("npm install @adnutum/sdk");
  await expect(page.locator("#createKeyBtn")).toBeVisible();

  expect(browserErrors, browserErrors.join("\n")).toEqual([]);
});
