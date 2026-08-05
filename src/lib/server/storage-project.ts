import { env } from "@/src/lib/server/env";

export type StorageScope = "public" | "private";

export type StorageScopeConfig = {
  project: string;
  scope: StorageScope;
  bucket: string;
  keyPrefix: string;
  endpoint: string;
  publicEndpoint?: string;
  region: string;
};

function cleanPrefix(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function requireValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required S3 configuration: ${name}`);
  }

  return value;
}

function scopedPrefix(scope: StorageScope) {
  const scopePrefix = scope === "public" ? env.S3_PUBLIC_KEY_PREFIX : env.S3_PRIVATE_KEY_PREFIX;
  return cleanPrefix(scopePrefix || env.S3_PROJECT_KEY_PREFIX);
}

export function getStorageProject() {
  return env.STORAGE_PROJECT || "portfolio";
}

export function getPublicStorageConfig(): StorageScopeConfig {
  return {
    project: getStorageProject(),
    scope: "public",
    bucket: requireValue(env.S3_PUBLIC_BUCKET || env.S3_BUCKET, "S3_PUBLIC_BUCKET or S3_BUCKET"),
    keyPrefix: scopedPrefix("public"),
    endpoint: requireValue(env.S3_ENDPOINT, "S3_ENDPOINT"),
    publicEndpoint: env.S3_PUBLIC_ENDPOINT || env.NEXT_PUBLIC_MEDIA_BASE_URL,
    region: env.S3_REGION,
  };
}

export function getPrivateStorageConfig(): StorageScopeConfig {
  return {
    project: getStorageProject(),
    scope: "private",
    bucket: requireValue(env.S3_PRIVATE_BUCKET, "S3_PRIVATE_BUCKET"),
    keyPrefix: scopedPrefix("private"),
    endpoint: requireValue(env.S3_ENDPOINT, "S3_ENDPOINT"),
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    region: env.S3_REGION,
  };
}

export function requireS3Credentials() {
  requireValue(env.S3_ACCESS_KEY_ID, "S3_ACCESS_KEY_ID");
  requireValue(env.S3_SECRET_ACCESS_KEY, "S3_SECRET_ACCESS_KEY");
}

export function toStorageObjectKey(config: Pick<StorageScopeConfig, "keyPrefix">, relativeKey: string) {
  const normalizedKey = cleanPrefix(relativeKey);
  const prefix = cleanPrefix(config.keyPrefix);

  if (!prefix) {
    return normalizedKey;
  }

  return normalizedKey ? `${prefix}/${normalizedKey}` : `${prefix}/`;
}

export function fromStorageObjectKey(config: Pick<StorageScopeConfig, "keyPrefix">, objectKey: string) {
  const normalizedKey = cleanPrefix(objectKey);
  const prefix = cleanPrefix(config.keyPrefix);

  if (!prefix) {
    return normalizedKey;
  }

  if (normalizedKey === prefix) {
    return "";
  }

  return normalizedKey.startsWith(`${prefix}/`) ? normalizedKey.slice(prefix.length + 1) : normalizedKey;
}

export function publicStorageObjectKey(relativeKey: string) {
  return toStorageObjectKey(getPublicStorageConfig(), relativeKey);
}

export function privateStorageObjectKey(relativeKey: string) {
  return toStorageObjectKey(getPrivateStorageConfig(), relativeKey);
}

export function publicStorageRelativeKey(objectKey: string) {
  return fromStorageObjectKey(getPublicStorageConfig(), objectKey);
}

export function privateStorageRelativeKey(objectKey: string) {
  return fromStorageObjectKey(getPrivateStorageConfig(), objectKey);
}

function joinUrl(base: string, bucket: string, key: string) {
  const normalizedBase = base.replace(/\/+$/, "");

  if (normalizedBase.endsWith(`/${bucket}`)) {
    return `${normalizedBase}/${key}`;
  }

  return `${normalizedBase}/${bucket}/${key}`;
}

export function publicStorageUrl(relativeKey: string) {
  const config = getPublicStorageConfig();
  const publicBase = env.NEXT_PUBLIC_MEDIA_BASE_URL ?? config.publicEndpoint ?? config.endpoint;
  return joinUrl(publicBase, config.bucket, toStorageObjectKey(config, relativeKey));
}
