import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  assertStorageProjectConfig,
  getStorageProjectConfig,
} from "./lib/storage-project.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
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
    process.env[key] ||= value;
  }
}

loadEnvFile(path.join(rootDir, ".env.runtime"));
loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env.full.local.generated"));

const storage = getStorageProjectConfig();

try {
  assertStorageProjectConfig(storage);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const publicBucket = storage.publicBucket;
const privateBucket = storage.privateBucket;

const client = new S3Client({
  endpoint: storage.endpoint,
  region: storage.region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
  },
});

async function ensureBucket(bucket) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`RustFS bucket already exists: ${bucket}`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Created RustFS bucket: ${bucket}`);
  }
}

async function applyCors(bucket) {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "HEAD", "PUT"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
  console.log(`Applied CORS to RustFS bucket: ${bucket}`);
}

async function applyPublicReadPolicy(bucket) {
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowPublicReadObjects",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }),
    }),
  );
  console.log(`Applied public-read policy to RustFS bucket: ${bucket}`);
}

await ensureBucket(publicBucket);
await ensureBucket(privateBucket);
await applyCors(publicBucket);
await applyCors(privateBucket);
await applyPublicReadPolicy(publicBucket);
console.log(
  `S3 project ready: ${storage.project} public=${publicBucket}/${storage.publicKeyPrefix || "(root)"} private=${privateBucket}/${storage.privateKeyPrefix || "(root)"}`,
);
