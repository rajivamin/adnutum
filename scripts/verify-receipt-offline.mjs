import fs from "node:fs";
import { webcrypto } from "node:crypto";

const crypto = webcrypto;

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ":" + stableJson(value[key])
  ).join(",") + "}";
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, "base64");
}

async function readJson(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not fetch ${source}: HTTP ${response.status}`);
    return response.json();
  }
  return JSON.parse(fs.readFileSync(source, "utf8"));
}

const [receiptSource = "receipt.json", keySource = "https://adnutum-api.ironpalmsumo.workers.dev/.well-known/jwks.json"] = process.argv.slice(2);

const receipt = await readJson(receiptSource);
const keySet = await readJson(keySource);

if (!receipt?.signed_payload || !receipt?.signature || receipt?.signature_algorithm !== "ES256") {
  console.error("SIGNATURE INVALID");
  console.error("Receipt is missing an ES256 signed payload or signature.");
  process.exit(1);
}

const keys = Array.isArray(keySet?.keys) ? keySet.keys : [];
const publicJwk = keys.find(key => key.kid === receipt.signing_key_id);

if (!publicJwk) {
  console.error("SIGNATURE INVALID");
  console.error(`No public key found for kid: ${receipt.signing_key_id || "(missing)"}`);
  process.exit(1);
}

const key = await crypto.subtle.importKey(
  "jwk",
  publicJwk,
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["verify"]
);

const valid = await crypto.subtle.verify(
  { name: "ECDSA", hash: "SHA-256" },
  key,
  fromBase64Url(receipt.signature),
  new TextEncoder().encode(stableJson(receipt.signed_payload))
);

if (!valid) {
  console.error("SIGNATURE INVALID");
  process.exit(1);
}

console.log("SIGNATURE VALID");
console.log(`Receipt: ${receipt.id || receipt.signed_payload.receiptId || "unknown"}`);
console.log(`Action: ${receipt.action || receipt.signed_payload.action || "unknown"}`);
console.log(`Key ID: ${receipt.signing_key_id}`);
console.log("Verified locally without calling /v1/verify.");
