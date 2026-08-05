import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/src/lib/server/env";
import {
  fromStorageObjectKey,
  getPublicStorageConfig,
  publicStorageUrl,
  requireS3Credentials,
  toStorageObjectKey,
} from "@/src/lib/server/storage-project";

const requiredKeys = [
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

function assertS3Config() {
  for (const key of requiredKeys) {
    if (!env[key]) {
      throw new Error(`Missing required S3 configuration: ${key}`);
    }
  }
}

function cleanPrefix(prefix?: string) {
  return (prefix ?? "").replace(/^\/+/, "");
}

function makeClient(endpoint = env.S3_ENDPOINT) {
  assertS3Config();
  requireS3Credentials();

  return new S3Client({
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export async function listMediaObjects(prefix?: string) {
  const storage = getPublicStorageConfig();
  const client = makeClient();
  const normalizedPrefix = cleanPrefix(prefix);
  const storagePrefix = toStorageObjectKey(storage, normalizedPrefix);
  const folderResponse = await client.send(
    new ListObjectsV2Command({
      Bucket: storage.bucket,
      Prefix: storagePrefix,
      Delimiter: "/",
    }),
  );
  const objectResponse = await client.send(
    new ListObjectsV2Command({
      Bucket: storage.bucket,
      Prefix: storagePrefix,
    }),
  );

  return {
    bucket: storage.bucket,
    prefix: normalizedPrefix,
    storagePrefix: storage.keyPrefix,
    project: storage.project,
    folders: (folderResponse.CommonPrefixes ?? [])
      .map((item) => item.Prefix)
      .filter((item): item is string => Boolean(item))
      .map((item) => {
        const relativePrefix = fromStorageObjectKey(storage, item);
        return { prefix: relativePrefix ? `${relativePrefix.replace(/\/+$/, "")}/` : "" };
      }),
    objects: (objectResponse.Contents ?? [])
      .filter((item) => item.Key)
      .map((item) => ({
        key: fromStorageObjectKey(storage, item.Key!),
        size: item.Size,
        lastModified: item.LastModified?.toISOString(),
        url: publicStorageUrl(fromStorageObjectKey(storage, item.Key!)),
      })),
  };
}

export async function createPresignedUploadUrl(key: string, contentType?: string) {
  const storage = getPublicStorageConfig();
  const client = makeClient(env.S3_PUBLIC_ENDPOINT ?? env.NEXT_PUBLIC_MEDIA_BASE_URL ?? env.S3_ENDPOINT);
  const command = new PutObjectCommand({
    Bucket: storage.bucket,
    Key: toStorageObjectKey(storage, key),
    ContentType: contentType || "application/octet-stream",
  });

  return getSignedUrl(client, command, { expiresIn: 300 });
}

export async function uploadMediaObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
) {
  const storage = getPublicStorageConfig();
  const client = makeClient();
  await client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: toStorageObjectKey(storage, key),
      Body: body,
      ContentType: contentType || "application/octet-stream",
    }),
  );
}

export async function getMediaObjectText(key: string) {
  const storage = getPublicStorageConfig();
  const client = makeClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: toStorageObjectKey(storage, key),
    }),
  );

  return response.Body?.transformToString() ?? "";
}

export async function deleteMediaObject(key: string) {
  const storage = getPublicStorageConfig();
  const client = makeClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: storage.bucket,
      Key: toStorageObjectKey(storage, key),
    }),
  );
}

export function getMediaStorageInfo() {
  const storage = getPublicStorageConfig();

  return {
    project: storage.project,
    bucket: storage.bucket,
    keyPrefix: storage.keyPrefix,
  };
}

export function getMediaPublicUrl(key: string) {
  return publicStorageUrl(key);
}
