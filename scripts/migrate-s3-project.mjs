import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  assertStorageProjectConfig,
  fromStorageObjectKey,
  getStorageProjectConfig,
  toStorageObjectKey,
} from "./lib/storage-project.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeArg = getArg("--include", "public,private");
const include = new Set(includeArg.split(",").map((value) => value.trim()).filter(Boolean));
const sourceEnvFile = getArg("--source-env");
const targetEnvFile = getArg("--target-env");

function getArg(flag, fallback = undefined) {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1] || fallback;
}

function loadEnvFile(filePath, { override = false } = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(rootDir, ".env.runtime"));
loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env.full.local.generated"));
loadEnvFile(path.join(rootDir, ".env.full.generated"));
loadEnvFile(sourceEnvFile && path.resolve(rootDir, sourceEnvFile), { override: true });
loadEnvFile(targetEnvFile && path.resolve(rootDir, targetEnvFile), { override: true });

const source = getStorageProjectConfig();
const target = getStorageProjectConfig({
  prefix: "S3_TARGET",
  fallback: {
    project: source.project,
    region: source.region,
    publicEndpoint: source.publicEndpoint,
  },
});

try {
  assertStorageProjectConfig(source);
  assertStorageProjectConfig(target);
} catch (error) {
  console.error(error.message);
  console.error("");
  console.error("Target variables use S3_TARGET_* names, for example:");
  console.error("S3_TARGET_ENDPOINT, S3_TARGET_ACCESS_KEY_ID, S3_TARGET_SECRET_ACCESS_KEY");
  console.error("S3_TARGET_PUBLIC_BUCKET or S3_TARGET_BUCKET, S3_TARGET_PRIVATE_BUCKET");
  process.exit(1);
}

function createClient(config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function listObjectKeys(client, bucket, prefix) {
  const keys = [];
  let ContinuationToken;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken,
      }),
    );

    keys.push(...(response.Contents || []).map((item) => item.Key).filter(Boolean));
    ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return keys;
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  if (typeof stream.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function rewritePrivateManifestIfNeeded({ relativeKey, body, contentType }) {
  const isJson = contentType?.includes("json") || relativeKey.endsWith(".json");
  const isFileManifest = relativeKey.startsWith("private/system/files/manifests/") && isJson;

  if (!isFileManifest) {
    return body;
  }

  try {
    const manifest = JSON.parse(body.toString("utf8"));
    if (manifest && typeof manifest === "object") {
      if (manifest.bucket) {
        manifest.bucket = target.privateBucket;
      }
      if (typeof manifest.objectKey === "string") {
        const relativeObjectKey = fromStorageObjectKey(source.privateKeyPrefix, manifest.objectKey);
        manifest.objectKey = toStorageObjectKey(target.privateKeyPrefix, relativeObjectKey);
      }
      manifest.migratedAt = new Date().toISOString();
      return Buffer.from(JSON.stringify(manifest, null, 2));
    }
  } catch {
    return body;
  }

  return body;
}

async function copyScope(scope) {
  const isPublic = scope === "public";
  const sourceBucket = isPublic ? source.publicBucket : source.privateBucket;
  const targetBucket = isPublic ? target.publicBucket : target.privateBucket;
  const sourcePrefix = isPublic ? source.publicKeyPrefix : source.privateKeyPrefix;
  const targetPrefix = isPublic ? target.publicKeyPrefix : target.privateKeyPrefix;
  const sourceClient = createClient(source);
  const targetClient = createClient(target);
  const listPrefix = sourcePrefix ? `${sourcePrefix}/` : "";
  const keys = await listObjectKeys(sourceClient, sourceBucket, listPrefix);

  console.log(
    `${dryRun ? "Would migrate" : "Migrating"} ${keys.length} ${scope} object(s): ${sourceBucket}/${listPrefix || "(root)"} -> ${targetBucket}/${targetPrefix || "(root)"}`,
  );

  let copied = 0;

  for (const sourceKey of keys) {
    const relativeKey = fromStorageObjectKey(sourcePrefix, sourceKey);
    const targetKey = toStorageObjectKey(targetPrefix, relativeKey);

    if (dryRun) {
      console.log(`[dry-run] ${scope}: ${sourceBucket}/${sourceKey} -> ${targetBucket}/${targetKey}`);
      copied += 1;
      continue;
    }

    const sourceObject = await sourceClient.send(
      new GetObjectCommand({
        Bucket: sourceBucket,
        Key: sourceKey,
      }),
    );
    const rawBody = await streamToBuffer(sourceObject.Body);
    const body = scope === "private"
      ? rewritePrivateManifestIfNeeded({
          relativeKey,
          body: rawBody,
          contentType: sourceObject.ContentType,
        })
      : rawBody;

    await targetClient.send(
      new PutObjectCommand({
        Bucket: targetBucket,
        Key: targetKey,
        Body: body,
        ContentType: sourceObject.ContentType || "application/octet-stream",
        CacheControl: sourceObject.CacheControl,
        ContentDisposition: sourceObject.ContentDisposition,
      }),
    );
    copied += 1;
  }

  return copied;
}

console.log(`S3 project migration: ${source.project} -> ${target.project}`);
console.log(`Mode: ${dryRun ? "dry-run" : "copy"}`);

let total = 0;
if (include.has("public")) {
  total += await copyScope("public");
}
if (include.has("private")) {
  total += await copyScope("private");
}

console.log(`${dryRun ? "Planned" : "Copied"} ${total} object(s).`);
