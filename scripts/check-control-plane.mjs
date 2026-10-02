import fs from "node:fs";

const source = fs.readFileSync("apps/api/src/control-plane.ts", "utf8").trim();
const prefix = "export const CONTROL_PLANE_HTML = ";

if (!source.startsWith(prefix) || !source.endsWith(";")) {
  throw new Error("control-plane.ts must export CONTROL_PLANE_HTML as one JSON string literal.");
}

const html = JSON.parse(source.slice(prefix.length, -1));

const failures = [];

if (html.includes("\\n")) {
  failures.push("Generated Control Plane contains a literal \\n sequence. Use a real line break instead.");
}

const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) {
  failures.push(`Duplicate HTML ids: ${duplicateIds.join(", ")}`);
}

const selectorIds = [
  ...html.matchAll(/querySelector\('#([^']+)'\)/g)
].map(match => match[1]);

const missingSelectors = [...new Set(selectorIds)].filter(id => !ids.includes(id));
if (missingSelectors.length) {
  failures.push(
    `JavaScript references missing DOM ids: ${missingSelectors.join(", ")}`
  );
}

const viewTargets = [
  ...html.matchAll(/data-view="([^"]+)"/g)
].map(match => match[1]);

const missingViews = [...new Set(viewTargets)].filter(id => !ids.includes(id));
if (missingViews.length) {
  failures.push(
    `Navigation references missing view sections: ${missingViews.join(", ")}`
  );
}

const requiredIds = [
  "tokenModal",
  "tokenInput",
  "unlockBtn",
  "overview",
  "requests",
  "agents",
  "policy",
  "developer",
  "createKeyBtn",
  "environmentList",
  "apiKeyList"
];

const missingRequired = requiredIds.filter(id => !ids.includes(id));
if (missingRequired.length) {
  failures.push(
    `Required Control Plane elements are missing: ${missingRequired.join(", ")}`
  );
}

if (failures.length) {
  console.error("AD NŪTUM Control Plane structural checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Control Plane structural checks passed: ${ids.length} ids, ${selectorIds.length} selector references, ${viewTargets.length} navigation targets.`
);
