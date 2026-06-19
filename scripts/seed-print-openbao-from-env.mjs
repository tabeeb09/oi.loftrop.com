import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const index = args.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
}

const sourceFile = getArg("--source", "/etc/print/deploy.env");

const config = {
  addr: process.env.BAO_ADDR,
  appRoleAuthPath: process.env.BAO_APPROLE_AUTH_PATH || "approle",
  roleId: process.env.OPENBAO_ROLE_ID || process.env.BAO_ROLE_ID,
  secretId: process.env.OPENBAO_SECRET_ID || process.env.BAO_SECRET_ID,
  jwtAuthPath: process.env.BAO_JWT_AUTH_PATH || "jwt",
  jwtRole: process.env.BAO_JWT_ROLE || "github-actions-deploy",
  token: process.env.BAO_TOKEN || process.env.BAO_DEV_ROOT_TOKEN,
  jwtToken: process.env.BAO_JWT_TOKEN,
  jwtTokenFile: process.env.BAO_JWT_TOKEN_FILE,
  kvMount: process.env.BAO_KV_MOUNT || "kv",
  path: process.env.BAO_SECRET_PATH_PRINT || "print/prod",
};

const secretKeys = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "KEYCLOAK_ISSUER",
  "KEYCLOAK_CLIENT_ID",
  "KEYCLOAK_CLIENT_SECRET",
  "KEYCLOAK_FILE_ADMIN_ROLES",
  "KEYCLOAK_QUEUE_ADMIN_ROLES",
  "KEYCLOAK_ROLE_CLAIM_PATH",
  "KEYCLOAK_FILE_UPLOAD_LIMIT_CLAIMS",
  "SUPERADMIN_EMAILS",
  "APP_BASE_URL",
  "S3_ENDPOINT",
  "S3_PUBLIC_ENDPOINT",
  "S3_PRIVATE_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "FILE_UPLOAD_MAX_BYTES",
  "FILE_ALLOWED_MIME_TYPES",
  "FILE_ALLOWED_EXTENSIONS",
  "ORCA_SLICER_BIN",
  "ORCA_MACHINE_PROFILE",
  "ORCA_PROCESS_PROFILE",
  "ORCA_FILAMENT_PROFILE_DIR",
];

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    env[key] = value;
  }

  return env;
}

function readJwt() {
  if (config.token || (config.roleId && config.secretId)) {
    return null;
  }

  if (config.jwtToken) {
    return config.jwtToken;
  }

  if (config.jwtTokenFile) {
    return fs.readFileSync(config.jwtTokenFile, "utf8").trim();
  }

  throw new Error(
    "Provide BAO_TOKEN, AppRole credentials (OPENBAO_ROLE_ID and OPENBAO_SECRET_ID), or BAO_JWT_TOKEN / BAO_JWT_TOKEN_FILE.",
  );
}

async function loginWithAppRole() {
  const response = await fetch(`${config.addr}/v1/auth/${config.appRoleAuthPath}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role_id: config.roleId,
      secret_id: config.secretId,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenBao AppRole login failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const token = payload?.auth?.client_token;

  if (!token) {
    throw new Error("OpenBao AppRole login did not return a client token.");
  }

  return token;
}

async function login(jwt) {
  if (config.token) {
    return config.token;
  }

  if (config.roleId && config.secretId) {
    return loginWithAppRole();
  }

  const response = await fetch(`${config.addr}/v1/auth/${config.jwtAuthPath}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: config.jwtRole,
      jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenBao JWT login failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const token = payload?.auth?.client_token;

  if (!token) {
    throw new Error("OpenBao did not return a client token.");
  }

  return token;
}

async function readSecret(clientToken) {
  const response = await fetch(`${config.addr}/v1/${config.kvMount}/data/${config.path}`, {
    headers: { "X-Vault-Token": clientToken },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to read ${config.path} from OpenBao (${response.status}).`);
  }

  const payload = await response.json();
  return payload?.data?.data ?? null;
}

async function writeSecret(clientToken, values) {
  const response = await fetch(`${config.addr}/v1/${config.kvMount}/data/${config.path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vault-Token": clientToken,
    },
    body: JSON.stringify({ data: values }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to write ${config.path} to OpenBao (${response.status}). ${body}`.trim(),
    );
  }
}

async function main() {
  if (!config.addr) {
    throw new Error("BAO_ADDR is required.");
  }

  const jwt = readJwt();
  const clientToken = await login(jwt);
  const existing = await readSecret(clientToken);

  if (existing && Object.keys(existing).length) {
    console.log(`OpenBao path ${config.path} already contains data. Skipping seed.`);
    return;
  }

  if (!fs.existsSync(sourceFile)) {
    throw new Error(
      `OpenBao path ${config.path} is empty and legacy source file is missing: ${sourceFile}`,
    );
  }

  const sourceEnv = parseEnvFile(sourceFile);
  const values = Object.fromEntries(
    secretKeys
      .filter((key) => sourceEnv[key])
      .map((key) => [key, sourceEnv[key]]),
  );

  const missing = ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "KEYCLOAK_ISSUER", "KEYCLOAK_CLIENT_ID", "KEYCLOAK_CLIENT_SECRET", "APP_BASE_URL", "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT", "S3_PRIVATE_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "FILE_UPLOAD_MAX_BYTES", "FILE_ALLOWED_EXTENSIONS"].filter((key) => !values[key]);

  if (missing.length) {
    throw new Error(
      `Legacy print env is missing required values for initial OpenBao seed:\n${missing.join("\n")}`,
    );
  }

  await writeSecret(clientToken, values);
  console.log(`Seeded OpenBao path ${config.path} from ${path.basename(sourceFile)}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
