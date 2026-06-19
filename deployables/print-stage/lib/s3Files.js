import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, parseCsv } from "./env";
import {
  FILAMENT_EXTRACT_VALUE,
  canExtractFilamentFromFile,
  getPrintEligibility,
  isExtractFilamentSelection,
  isValidFilamentSelection,
} from "./printPolicy";
import { extractOrca3mfMetadataFromBuffer } from "./orca3mf";

const DEFAULT_PAGE_SIZE = 25;
const DOWNLOAD_URL_TTL_SECONDS = 60;
const UPLOAD_URL_TTL_SECONDS = 300;
const MANIFEST_FOLDER = "private/system/files/manifests";
const PRINT_QUEUE_FOLDER = "private/system/print-queue";

function createS3Client() {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

function createPublicS3Client() {
  return new S3Client({
    endpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

function sanitizeFilename(filename) {
  const normalized = filename
    .normalize("NFKC")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "file";
}

function getFileExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function buildObjectKey(ownerSub, fileId, filename) {
  return `private/users/${ownerSub}/${fileId}/${sanitizeFilename(filename)}`;
}

function buildManifestKey(fileId) {
  return `${MANIFEST_FOLDER}/${fileId}.json`;
}

function buildPrintQueueObjectKey(ownerSub, fileId, filename) {
  return `${PRINT_QUEUE_FOLDER}/${ownerSub}/${fileId}/${sanitizeFilename(filename)}`;
}

function decodeCursor(cursor) {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function encodeCursor(offset) {
  return String(offset);
}

function canAccessFile(actor, ownerSub) {
  return actor.isFileAdmin || actor.sub === ownerSub;
}

function canManagePrintQueue(actor) {
  return Boolean(actor?.isQueueAdmin);
}

function getPrintState(manifest) {
  return manifest.printStatus ?? "idle";
}

function assertAllowedFile(request) {
  const trimmedFilename = request.filename?.trim();

  if (!trimmedFilename) {
    throw new Error("Filename is required.");
  }

  const uploadLimitBytes =
    typeof request.uploadLimitBytes === "number" && request.uploadLimitBytes > 0
      ? request.uploadLimitBytes
      : env.FILE_UPLOAD_MAX_BYTES;

  if (typeof request.sizeBytes === "number" && request.sizeBytes > uploadLimitBytes) {
    throw new Error(`File exceeds the maximum allowed size of ${uploadLimitBytes} bytes.`);
  }

  const allowedMimeTypes = parseCsv(env.FILE_ALLOWED_MIME_TYPES);
  const allowedExtensions = parseCsv(env.FILE_ALLOWED_EXTENSIONS).map((value) =>
    value.toLowerCase().replace(/^\./, ""),
  );
  const extension = getFileExtension(trimmedFilename);
  const mimeType = request.mimeType?.trim();
  const mimeAllowed =
    !allowedMimeTypes.length || (mimeType ? allowedMimeTypes.includes(mimeType) : false);
  const extensionAllowed =
    !allowedExtensions.length || (extension ? allowedExtensions.includes(extension) : false);

  if ((allowedMimeTypes.length || allowedExtensions.length) && !mimeAllowed && !extensionAllowed) {
    throw new Error("File type is not allowed.");
  }
}

async function ensureBucketExists() {
  const client = createS3Client();
  await client.send(new HeadBucketCommand({ Bucket: env.S3_PRIVATE_BUCKET }));
}

async function writeManifest(manifest) {
  await ensureBucketExists();
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      Key: buildManifestKey(manifest.id),
      Body: JSON.stringify(manifest),
      ContentType: "application/json",
    }),
  );
}

async function readManifest(fileId) {
  const client = createS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: env.S3_PRIVATE_BUCKET,
        Key: buildManifestKey(fileId),
      }),
    );
    const text = await response.Body?.transformToString();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readObjectBuffer(objectKey) {
  const client = createS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      Key: objectKey,
    }),
  );

  const bytes = await response.Body?.transformToByteArray();
  return bytes ? Buffer.from(bytes) : Buffer.from([]);
}

async function getObjectInfo(objectKey) {
  const client = createS3Client();

  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: env.S3_PRIVATE_BUCKET,
        Key: objectKey,
      }),
    );
  } catch {
    return null;
  }
}

async function hydrateManifest(manifest) {
  const objectInfo = await getObjectInfo(manifest.objectKey);

  if (!objectInfo) {
    return manifest;
  }

  const hydrated = {
    ...manifest,
    mimeType: manifest.mimeType ?? objectInfo.ContentType ?? undefined,
    sizeBytes:
      typeof manifest.sizeBytes === "number"
        ? manifest.sizeBytes
        : typeof objectInfo.ContentLength === "number"
          ? objectInfo.ContentLength
          : undefined,
    status: manifest.status === "rejected" ? "rejected" : "uploaded",
    updatedAt: new Date().toISOString(),
    printStatus: getPrintState(manifest),
    printRequestedAt: manifest.printRequestedAt ?? null,
    printStartedAt: manifest.printStartedAt ?? null,
    printQueueObjectKey: manifest.printQueueObjectKey ?? null,
    filamentSelection: manifest.filamentSelection ?? null,
    extractionStatus: manifest.extractionStatus ?? "not_requested",
    extractedFilamentType: manifest.extractedFilamentType ?? null,
    extractedGrams: manifest.extractedGrams ?? null,
    extractionError: manifest.extractionError ?? null,
  };

  if (
    hydrated.status !== manifest.status ||
    hydrated.sizeBytes !== manifest.sizeBytes ||
    hydrated.mimeType !== manifest.mimeType
  ) {
    await writeManifest(hydrated);
  }

  return hydrated;
}

async function listManifestFiles(ownerSub, limit, offset) {
  const client = createS3Client();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: env.S3_PRIVATE_BUCKET,
      Prefix: `${MANIFEST_FOLDER}/`,
      MaxKeys: 200,
    }),
  );

  const keys = (response.Contents ?? [])
    .map((item) => item.Key)
    .filter((key) => Boolean(key) && key.endsWith(".json"))
    .sort()
    .reverse();

  const manifests = [];

  for (const key of keys.slice(offset)) {
    const manifest = await readManifest(key.replace(`${MANIFEST_FOLDER}/`, "").replace(/\.json$/, ""));

    if (manifest && manifest.ownerSub === ownerSub) {
      manifests.push(manifest);
    }

    if (manifests.length >= limit) {
      break;
    }
  }

  return {
    manifests,
    totalKeys: keys.length,
  };
}

async function listAllManifestKeys() {
  const client = createS3Client();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: env.S3_PRIVATE_BUCKET,
      Prefix: `${MANIFEST_FOLDER}/`,
      MaxKeys: 1000,
    }),
  );

  return (response.Contents ?? [])
    .map((item) => item.Key)
    .filter((key) => Boolean(key) && key.endsWith(".json"))
    .sort()
    .reverse();
}

async function readAllManifests() {
  const keys = await listAllManifestKeys();
  const manifests = [];

  for (const key of keys) {
    const manifest = await readManifest(key.replace(`${MANIFEST_FOLDER}/`, "").replace(/\.json$/, ""));

    if (manifest) {
      manifests.push(manifest);
    }
  }

  return manifests;
}

async function deleteQueueCopyIfPresent(manifest) {
  if (!manifest?.printQueueObjectKey) {
    return;
  }

  const client = createS3Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.S3_PRIVATE_BUCKET,
        Key: manifest.printQueueObjectKey,
      }),
    );
  } catch {}
}

async function computeUsedBytes(ownerSub) {
  const allManifests = await readAllManifests();

  return allManifests
    .filter((manifest) => manifest.ownerSub === ownerSub)
    .reduce((total, manifest) => total + (typeof manifest.sizeBytes === "number" ? manifest.sizeBytes : 0), 0);
}

export async function createUploadUrl(actor, request) {
  if (!isValidFilamentSelection(request.filamentSelection)) {
    throw new Error("A valid filament selection is required before upload.");
  }

  const usedBytes = await computeUsedBytes(actor.sub);
  const uploadLimitBytes = actor.uploadLimitBytes;
  const remainingBytes = Math.max(uploadLimitBytes - usedBytes, 0);
  const requestedSizeBytes = typeof request.sizeBytes === "number" ? request.sizeBytes : 0;

  if (requestedSizeBytes > remainingBytes) {
    throw new Error(`Upload limit exceeded. ${remainingBytes} bytes remaining for this account.`);
  }

  assertAllowedFile({
    ...request,
    uploadLimitBytes: remainingBytes,
  });

  const fileId = crypto.randomUUID();
  const objectKey = buildObjectKey(actor.sub, fileId, request.filename);
  const manifest = {
    id: fileId,
    ownerSub: actor.sub,
    bucket: env.S3_PRIVATE_BUCKET,
    objectKey,
    originalFilename: request.filename,
    mimeType: request.mimeType || undefined,
    sizeBytes: request.sizeBytes,
    status: "pending",
    visibility: request.visibility ?? "private",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    printStatus: "idle",
    printRequestedAt: null,
    printStartedAt: null,
    printQueueObjectKey: null,
    filamentSelection: request.filamentSelection,
    extractionStatus: isExtractFilamentSelection(request.filamentSelection)
      ? "pending"
      : "not_requested",
    extractedFilamentType: null,
    extractedGrams: null,
    extractionError: null,
  };

  await writeManifest(manifest);

  const client = createPublicS3Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      Key: objectKey,
      ContentType: request.mimeType || "application/octet-stream",
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return {
    file: manifest,
    uploadUrl,
    uploadMethod: "PUT",
    uploadHeaders: request.mimeType ? { "Content-Type": request.mimeType } : {},
  };
}

export async function listFiles(actor, options = {}) {
  const ownerSub = options.ownerSub && actor.isFileAdmin ? options.ownerSub : actor.sub;
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), 100);
  const offset = decodeCursor(options.cursor);
  const { manifests, totalKeys } = await listManifestFiles(ownerSub, limit, offset);
  const files = await Promise.all(manifests.map(hydrateManifest));
  const usedBytes = await computeUsedBytes(ownerSub);
  const uploadLimitBytes = ownerSub === actor.sub ? actor.uploadLimitBytes : null;

  return {
    files: files.filter((file) => canAccessFile(actor, file.ownerSub)),
    nextCursor: offset + manifests.length < totalKeys ? encodeCursor(offset + manifests.length) : null,
    summary: {
      usedBytes,
      uploadLimitBytes,
      remainingBytes:
        typeof uploadLimitBytes === "number" ? Math.max(uploadLimitBytes - usedBytes, 0) : null,
    },
    actor: {
      isFileAdmin: actor.isFileAdmin,
      isQueueAdmin: actor.isQueueAdmin,
      email: actor.email,
    },
  };
}

export async function createDownloadUrl(actor, fileId) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const hydrated = await hydrateManifest(manifest);
  const client = createPublicS3Client();
  const downloadUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      Key: hydrated.objectKey,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(
        hydrated.originalFilename,
      )}`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );

  return {
    file: hydrated,
    downloadUrl,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  };
}

export async function deleteFile(actor, fileId) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  if (getPrintState(manifest) !== "idle") {
    throw new Error("Cannot delete a file that is in the print queue.");
  }

  const client = createS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      Key: manifest.objectKey,
    }),
  );
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      Key: buildManifestKey(fileId),
    }),
  );

  return { id: fileId };
}

export async function updateFileMetadata(actor, fileId, updates) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const next = { ...manifest };

  if (Object.prototype.hasOwnProperty.call(updates, "filamentSelection")) {
    if (!isValidFilamentSelection(updates.filamentSelection)) {
      throw new Error("A valid filament selection is required.");
    }

    next.filamentSelection = updates.filamentSelection;
    next.extractionStatus = isExtractFilamentSelection(updates.filamentSelection)
      ? "pending"
      : "not_requested";
    next.extractedFilamentType = null;
    next.extractedGrams = null;
    next.extractionError = null;
  }

  next.updatedAt = new Date().toISOString();
  await writeManifest(next);
  return hydrateManifest(next);
}

export async function verifyFileFilamentMetadata(actor, fileId) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  if (!isExtractFilamentSelection(manifest.filamentSelection)) {
    return hydrateManifest({
      ...manifest,
      extractionStatus: "not_requested",
      extractionError: null,
    });
  }

  if (!canExtractFilamentFromFile(manifest)) {
    const failed = {
      ...manifest,
      extractionStatus: "failed",
      extractionError: "Filament extraction is only supported for 3MF files.",
      updatedAt: new Date().toISOString(),
    };
    await writeManifest(failed);
    return hydrateManifest(failed);
  }

  const objectBuffer = await readObjectBuffer(manifest.objectKey);
  const extracted = await extractOrca3mfMetadataFromBuffer(objectBuffer, manifest.originalFilename);
  const updated = {
    ...manifest,
    ...extracted,
    updatedAt: new Date().toISOString(),
  };

  await writeManifest(updated);
  return hydrateManifest(updated);
}

export async function requestPrint(actor, fileId) {
  let manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const printState = getPrintState(manifest);

  if (printState !== "idle") {
    throw new Error("File is already queued for printing.");
  }

  if (isExtractFilamentSelection(manifest.filamentSelection)) {
    manifest = await verifyFileFilamentMetadata(actor, fileId);
  }

  const printEligibility = getPrintEligibility(manifest);

  if (!printEligibility.canPrint) {
    throw new Error(printEligibility.reason);
  }

  const queueObjectKey = buildPrintQueueObjectKey(
    manifest.ownerSub,
    manifest.id,
    manifest.originalFilename,
  );
  const client = createS3Client();
  await client.send(
    new CopyObjectCommand({
      Bucket: env.S3_PRIVATE_BUCKET,
      CopySource: `${env.S3_PRIVATE_BUCKET}/${manifest.objectKey}`,
      Key: queueObjectKey,
    }),
  );

  const updated = {
    ...manifest,
    printStatus: "queued",
    printRequestedAt: new Date().toISOString(),
    printStartedAt: null,
    printQueueObjectKey: queueObjectKey,
    updatedAt: new Date().toISOString(),
  };

  await writeManifest(updated);
  return hydrateManifest(updated);
}

export async function cancelPrint(actor, fileId) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const printState = getPrintState(manifest);

  if (printState === "idle") {
    throw new Error("File is not in the print queue.");
  }

  if (printState === "printing" && !canManagePrintQueue(actor)) {
    throw new Error("Forbidden");
  }

  await deleteQueueCopyIfPresent(manifest);

  const updated = {
    ...manifest,
    printStatus: "idle",
    printRequestedAt: null,
    printStartedAt: null,
    printQueueObjectKey: null,
    updatedAt: new Date().toISOString(),
  };

  await writeManifest(updated);
  return hydrateManifest(updated);
}

export async function listPrintQueue(actor) {
  if (!canManagePrintQueue(actor)) {
    throw new Error("Forbidden");
  }

  const manifests = await readAllManifests();
  const queueFiles = manifests
    .filter((manifest) => {
      const printState = getPrintState(manifest);
      return printState === "queued" || printState === "printing";
    })
    .sort((left, right) => {
      const leftPrinting = getPrintState(left) === "printing";
      const rightPrinting = getPrintState(right) === "printing";

      if (leftPrinting && !rightPrinting) {
        return -1;
      }

      if (!leftPrinting && rightPrinting) {
        return 1;
      }

      return new Date(left.printRequestedAt ?? left.createdAt).getTime() -
        new Date(right.printRequestedAt ?? right.createdAt).getTime();
    });

  return {
    files: await Promise.all(queueFiles.map(hydrateManifest)),
  };
}

export async function markNextQueuedFileAsPrinting(actor) {
  if (!canManagePrintQueue(actor)) {
    throw new Error("Forbidden");
  }

  const manifests = await readAllManifests();
  const currentPrinting = manifests.find((manifest) => getPrintState(manifest) === "printing");

  if (currentPrinting) {
    return hydrateManifest(currentPrinting);
  }

  const nextQueued = manifests
    .filter((manifest) => getPrintState(manifest) === "queued")
    .sort(
      (left, right) =>
        new Date(left.printRequestedAt ?? left.createdAt).getTime() -
        new Date(right.printRequestedAt ?? right.createdAt).getTime(),
    )[0];

  if (!nextQueued) {
    throw new Error("No queued files available.");
  }

  const updated = {
    ...nextQueued,
    printStatus: "printing",
    printStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeManifest(updated);
  return hydrateManifest(updated);
}
