export function cleanPrefix(value = "") {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function readEnv(name, fallback = undefined, source = process.env) {
  const value = source[name];
  return value === undefined || value === "" ? fallback : value;
}

function required(value, name) {
  if (!value) {
    throw new Error(`Missing required S3 configuration: ${name}`);
  }

  return value;
}

function prefixedName(prefix, name) {
  return prefix ? `${prefix}_${name}` : name;
}

function readPrefixedEnv(prefix, name, fallback = undefined, source = process.env) {
  if (prefix === "S3_TARGET" && name.startsWith("S3_")) {
    const s3TargetName = `S3_TARGET_${name.slice("S3_".length)}`;
    const value = readEnv(s3TargetName, undefined, source);
    if (value !== undefined) {
      return value;
    }
  }

  if (prefix === "S3_SOURCE" && name.startsWith("S3_")) {
    const s3SourceName = `S3_SOURCE_${name.slice("S3_".length)}`;
    const value = readEnv(s3SourceName, undefined, source);
    if (value !== undefined) {
      return value;
    }
  }

  return readEnv(prefixedName(prefix, name), fallback, source);
}

export function getStorageProjectConfig({ prefix = "", fallback = null, source = process.env } = {}) {
  const project = readPrefixedEnv(prefix, "STORAGE_PROJECT", fallback?.project || "portfolio", source);
  const endpoint = readPrefixedEnv(prefix, "S3_ENDPOINT", fallback?.endpoint, source);
  const publicEndpoint = readPrefixedEnv(prefix, "S3_PUBLIC_ENDPOINT", fallback?.publicEndpoint, source);
  const region = readPrefixedEnv(prefix, "S3_REGION", fallback?.region || "us-east-1", source);
  const accessKeyId = readPrefixedEnv(prefix, "S3_ACCESS_KEY_ID", fallback?.accessKeyId, source);
  const secretAccessKey = readPrefixedEnv(prefix, "S3_SECRET_ACCESS_KEY", fallback?.secretAccessKey, source);
  const publicBucket = readPrefixedEnv(
    prefix,
    "S3_PUBLIC_BUCKET",
    readPrefixedEnv(prefix, "S3_BUCKET", fallback?.publicBucket, source),
    source,
  );
  const privateBucket = readPrefixedEnv(prefix, "S3_PRIVATE_BUCKET", fallback?.privateBucket, source);
  const projectKeyPrefix = readPrefixedEnv(prefix, "S3_PROJECT_KEY_PREFIX", fallback?.projectKeyPrefix || "", source);
  const publicKeyPrefix = readPrefixedEnv(prefix, "S3_PUBLIC_KEY_PREFIX", projectKeyPrefix, source);
  const privateKeyPrefix = readPrefixedEnv(prefix, "S3_PRIVATE_KEY_PREFIX", projectKeyPrefix, source);

  return {
    project,
    endpoint,
    publicEndpoint,
    region,
    accessKeyId,
    secretAccessKey,
    publicBucket,
    privateBucket,
    projectKeyPrefix: cleanPrefix(projectKeyPrefix),
    publicKeyPrefix: cleanPrefix(publicKeyPrefix),
    privateKeyPrefix: cleanPrefix(privateKeyPrefix),
  };
}

export function assertStorageProjectConfig(config, { requirePrivate = true } = {}) {
  required(config.endpoint, "S3_ENDPOINT");
  required(config.publicBucket, "S3_PUBLIC_BUCKET or S3_BUCKET");
  if (requirePrivate) {
    required(config.privateBucket, "S3_PRIVATE_BUCKET");
  }
  required(config.accessKeyId, "S3_ACCESS_KEY_ID");
  required(config.secretAccessKey, "S3_SECRET_ACCESS_KEY");
}

export function toStorageObjectKey(keyPrefix, relativeKey = "") {
  const normalizedKey = cleanPrefix(relativeKey);
  const normalizedPrefix = cleanPrefix(keyPrefix);

  if (!normalizedPrefix) {
    return normalizedKey;
  }

  return normalizedKey ? `${normalizedPrefix}/${normalizedKey}` : `${normalizedPrefix}/`;
}

export function fromStorageObjectKey(keyPrefix, objectKey = "") {
  const normalizedKey = cleanPrefix(objectKey);
  const normalizedPrefix = cleanPrefix(keyPrefix);

  if (!normalizedPrefix) {
    return normalizedKey;
  }

  if (normalizedKey === normalizedPrefix) {
    return "";
  }

  return normalizedKey.startsWith(`${normalizedPrefix}/`)
    ? normalizedKey.slice(normalizedPrefix.length + 1)
    : normalizedKey;
}
