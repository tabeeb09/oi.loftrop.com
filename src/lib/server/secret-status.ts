const SECRET_GROUPS = {
  websiteAuth: [
    "AUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_SITE_URL",
    "KEYCLOAK_ISSUER",
    "KEYCLOAK_CLIENT_ID",
    "KEYCLOAK_CLIENT_SECRET",
  ],
  cmsMedia: [
    "NEXT_PUBLIC_MEDIA_BASE_URL",
    "NEXT_PUBLIC_MEDIA_BUCKET",
    "STORAGE_PROJECT",
    "S3_ENDPOINT",
    "S3_PUBLIC_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ],
  userFilesStorage: [
    "FILE_STORAGE_PROVIDER",
  ],
  keycloakAdminSync: [
    "KEYCLOAK_ADMIN_REALM",
    "KEYCLOAK_ADMIN_CLIENT_ID",
  ],
  oauth2Proxy: [
    "OAUTH2_PROXY_CLIENT_ID",
    "OAUTH2_PROXY_CLIENT_SECRET",
    "OAUTH2_PROXY_COOKIE_SECRET",
    "OAUTH2_PROXY_REDIRECT_URL",
  ],
  openbaoClient: [
    "BAO_ADDR",
    "BAO_KV_MOUNT",
    "BAO_SECRET_PATH_WEBSITE",
    "BAO_SECRET_PATH_RUSTFS",
    "BAO_SECRET_PATH_OAUTH2_PROXY",
    "BAO_SECRET_PATH_KEYCLOAK",
    "BAO_SECRET_PATH_SUPABASE",
  ],
} as const;

export type SecretGroupName = keyof typeof SECRET_GROUPS;

const SECRET_DEFAULTS: Partial<Record<string, string>> = {
  STORAGE_PROJECT: "portfolio",
  NEXT_PUBLIC_MEDIA_BUCKET: "public-media",
  BAO_KV_MOUNT: "kv",
  BAO_SECRET_PATH_WEBSITE: "website/prod",
  BAO_SECRET_PATH_RUSTFS: "rustfs/prod",
  BAO_SECRET_PATH_OAUTH2_PROXY: "oauth2-proxy/prod",
  BAO_SECRET_PATH_KEYCLOAK: "keycloak/prod",
  BAO_SECRET_PATH_SUPABASE: "supabase/prod",
};

function hasAdminCredential() {
  const hasClientSecret = Boolean(process.env.KEYCLOAK_ADMIN_CLIENT_SECRET);
  const hasUserPassword = Boolean(
    process.env.KEYCLOAK_ADMIN_USERNAME && process.env.KEYCLOAK_ADMIN_PASSWORD,
  );

  return hasClientSecret || hasUserPassword;
}

function getFileStorageProvider() {
  return process.env.FILE_STORAGE_PROVIDER || "local";
}

export function getMissingSecrets(group: SecretGroupName) {
  if (group === "userFilesStorage") {
    const provider = getFileStorageProvider();

    if (provider === "local") {
      return [];
    }

    if (provider === "supabase") {
      return ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"].filter(
        (key) => !process.env[key],
      );
    }

    if (provider === "s3") {
      return ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PRIVATE_BUCKET"].filter(
        (key) => !process.env[key],
      );
    }

    return ["FILE_STORAGE_PROVIDER"];
  }

  const missing = SECRET_GROUPS[group].filter((key) => {
    if (group === "cmsMedia" && key === "S3_BUCKET" && process.env.S3_PUBLIC_BUCKET) {
      return false;
    }

    const configured = process.env[key];
    const fallback = SECRET_DEFAULTS[key];

    return !configured && !fallback;
  });

  if (group === "keycloakAdminSync" && !hasAdminCredential()) {
    missing.push(
      "KEYCLOAK_ADMIN_CLIENT_SECRET or KEYCLOAK_ADMIN_USERNAME + KEYCLOAK_ADMIN_PASSWORD",
    );
  }

  return missing;
}

export function getAllSecretStatuses() {
  return Object.keys(SECRET_GROUPS).map((group) => ({
    group: group as SecretGroupName,
    missing: getMissingSecrets(group as SecretGroupName),
  }));
}
