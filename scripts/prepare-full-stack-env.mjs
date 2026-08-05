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

const mode = getArg("--mode", "local");
const baseFile = getArg("--base", mode === "local" ? ".env.full.local" : ".env.example");
const runtimeFile = getArg("--runtime", ".env.runtime");
const outputFile = getArg(
  "--output",
  mode === "local" ? ".env.full.local.generated" : ".env.full.generated",
);

const defaults = {
  BAO_KV_MOUNT: "kv",
  BAO_SECRET_PATH_WEBSITE: "website/prod",
  BAO_SECRET_PATH_RUSTFS: "rustfs/prod",
  BAO_SECRET_PATH_OAUTH2_PROXY: "oauth2-proxy/prod",
  BAO_SECRET_PATH_KEYCLOAK: "keycloak/prod",
  BAO_SECRET_PATH_SUPABASE: "supabase/prod",
};

const requiredByMode = {
  local: [
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_MEDIA_BASE_URL",
    "FILE_STORAGE_PROVIDER",
    "S3_ENDPOINT",
    "S3_PUBLIC_ENDPOINT",
    "S3_BUCKET",
    "S3_PRIVATE_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "KEYCLOAK_ISSUER",
    "KEYCLOAK_CLIENT_ID",
    "KEYCLOAK_CLIENT_SECRET",
    "OAUTH2_PROXY_CLIENT_ID",
    "OAUTH2_PROXY_CLIENT_SECRET",
    "OAUTH2_PROXY_COOKIE_SECRET",
    "OAUTH2_PROXY_REDIRECT_URL",
    "BAO_ADDR",
  ],
  prod: [
    "APP_HOST",
    "MEDIA_HOST",
    "RUSTFS_ADMIN_HOST",
    "OAUTH2_PROXY_HOST",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_MEDIA_BASE_URL",
    "FILE_STORAGE_PROVIDER",
    "S3_ENDPOINT",
    "S3_PUBLIC_ENDPOINT",
    "S3_BUCKET",
    "S3_PRIVATE_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "KEYCLOAK_ISSUER",
    "KEYCLOAK_CLIENT_ID",
    "KEYCLOAK_CLIENT_SECRET",
    "KEYCLOAK_ADMIN_REALM",
    "KEYCLOAK_ADMIN_CLIENT_ID",
    "OAUTH2_PROXY_CLIENT_ID",
    "OAUTH2_PROXY_CLIENT_SECRET",
    "OAUTH2_PROXY_COOKIE_SECRET",
    "OAUTH2_PROXY_REDIRECT_URL",
    "BAO_ADDR",
  ],
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
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
  const resolveInputPath = (filePath) =>
    path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);

  const basePath = resolveInputPath(baseFile);
  const runtimePath = resolveInputPath(runtimeFile);
  const outputPath = resolveInputPath(outputFile);

  assertPresent(basePath);
  assertPresent(runtimePath);

  const baseEnv = parseEnvFile(basePath);
  const runtimeEnv = parseEnvFile(runtimePath);
  const merged = {
    ...defaults,
    ...baseEnv,
    ...runtimeEnv,
  };

  const requiredKeys = requiredByMode[mode];

  if (!requiredKeys) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const provider = merged.FILE_STORAGE_PROVIDER || "local";
  const storageSpecificKeys =
    provider === "supabase"
      ? ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"]
      : provider === "s3"
        ? ["S3_PRIVATE_BUCKET"]
        : [];

  const relaxedKeys = new Set([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "S3_PRIVATE_BUCKET",
  ]);

  const missing = [...requiredKeys, ...storageSpecificKeys].filter((key) => {
    if (key === "S3_BUCKET" && merged.S3_PUBLIC_BUCKET) {
      return false;
    }

    if (!merged[key]) {
      if (relaxedKeys.has(key) && !storageSpecificKeys.includes(key)) {
        return false;
      }

      return true;
    }

    return false;
  });

  if (missing.length) {
    throw new Error(
      `Cannot prepare ${outputFile}. Missing required configuration:\n${missing.join("\n")}`,
    );
  }

  fs.writeFileSync(outputPath, `${toEnvBlock(merged)}\n`, "utf8");
  console.log(`Prepared ${outputFile} from ${baseFile} and ${runtimeFile}.`);
}

main();
