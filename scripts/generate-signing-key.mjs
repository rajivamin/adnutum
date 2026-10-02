import { generateKeyPairSync, randomUUID } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256"
});

const privateJwk = privateKey.export({ format: "jwk" });
const publicJwk = publicKey.export({ format: "jwk" });
const keyId = "adnutum-" + randomUUID();

privateJwk.alg = "ES256";
privateJwk.use = "sig";
privateJwk.kid = keyId;
privateJwk.key_ops = ["sign"];

publicJwk.alg = "ES256";
publicJwk.use = "sig";
publicJwk.kid = keyId;
publicJwk.key_ops = ["verify"];

console.log("\nSIGNING_KEY_ID\n");
console.log(keyId);
console.log("\nSIGNING_PRIVATE_JWK\n");
console.log(JSON.stringify(privateJwk));
console.log("\nPUBLIC_JWK (safe to share)\n");
console.log(JSON.stringify(publicJwk, null, 2));
console.log("\nKeep SIGNING_PRIVATE_JWK secret. Do not commit it to Git.\n");
