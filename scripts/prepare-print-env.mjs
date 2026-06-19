import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const index = args.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
}

const runtimeFile = getArg("--runtime", ".env.runtime");
const baseFile = getArg("--base", "");
const outputFile = getArg("--output", ".env.print.generated");

const defaults = {
  S3_REGION: "us-east-1",
  KEYCLOAK_FILE_ADMIN_ROLES: "owner,technician,print_admin,media_admin",
  KEYCLOAK_QUEUE_ADMIN_ROLES: "owner,technician,print_admin,queue_admin",
  KEYCLOAK_ROLE_CLAIM_PATH: "resource_access.website.roles",
  KEYCLOAK_FILE_UPLOAD_LIMIT_CLAIMS: "file_upload_limit_bytes,fileUploadLimitBytes",
  SUPERADMIN_EMAILS: "tabeebrahman.logistics@gmail.com",
  FILE_ALLOWED_MIME_TYPES: "",
  FILE_ALLOWED_EXTENSIONS: "3mf,stl,obj,step,stp,iges,igs,ply,amf",
  RUSTFS_NETWORK: "rustfs_internal",
};

const requiredKeys = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "KEYCLOAK_ISSUER",
  "KEYCLOAK_CLIENT_ID",
  "KEYCLOAK_CLIENT_SECRET",
  "APP_BASE_URL",
  "S3_ENDPOINT",
  "S3_PUBLIC_ENDPOINT",
  "S3_PRIVATE_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "FILE_UPLOAD_MAX_BYTES",
  "FILE_ALLOWED_EXTENSIONS",
];

function resolveInputPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

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

function toEnvBlock(values) {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
}

function assertPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file is missing: ${path.basename(filePath)}`);
  }
}

function main() {
  const runtimePath = resolveInputPath(runtimeFile);
  const basePath = baseFile ? resolveInputPath(baseFile) : "";
  const outputPath = resolveInputPath(outputFile);

  assertPresent(runtimePath);

  const merged = {
    ...defaults,
    ...parseEnvFile(basePath),
    ...parseEnvFile(runtimePath),
  };

  const missing = requiredKeys.filter((key) => !merged[key]);

  if (missing.length) {
    throw new Error(
      `Cannot prepare ${path.basename(outputPath)}. Missing required configuration:\n${missing.join("\n")}`,
    );
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${toEnvBlock(merged)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Prepared ${path.basename(outputPath)} from OpenBao runtime secrets.`);
}

main();
