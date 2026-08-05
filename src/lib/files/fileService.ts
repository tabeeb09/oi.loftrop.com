import type {
  CreateDownloadUrlResult,
  CreateUploadUrlResult,
  FileListResult,
  UploadUrlRequest,
} from "./types";
import {
  createLocalDownloadUrl,
  createLocalUploadUrl,
  deleteLocalFile,
  listLocalFiles,
  performLocalUpload,
  streamLocalDownload,
} from "./localFileAdapter";
import {
  createS3DownloadUrl,
  createS3UploadUrl,
  deleteS3File,
  listS3Files,
} from "./s3FileAdapter";
import {
  createSupabaseDownloadUrl,
  createSupabaseUploadUrl,
  deleteSupabaseFile,
  listSupabaseFiles,
} from "./supabaseFileAdapter";
import { env } from "@/src/lib/server/env";

type FileActor = {
  sub: string;
  roles: string[];
  isFileAdmin: boolean;
  uploadLimitBytes: number;
};

type FileListOptions = {
  cursor?: string | null;
  ownerSub?: string | null;
  limit?: number;
};

function getProvider() {
  return env.FILE_STORAGE_PROVIDER;
}

export async function createUploadUrl(
  actor: FileActor,
  fileInfo: UploadUrlRequest,
): Promise<CreateUploadUrlResult> {
  switch (getProvider()) {
    case "local":
      return createLocalUploadUrl(actor, fileInfo);
    case "s3":
      return createS3UploadUrl(actor, fileInfo);
    default:
      return createSupabaseUploadUrl(actor, fileInfo);
  }
}

export async function listUserFiles(
  actor: FileActor,
  options: FileListOptions = {},
): Promise<FileListResult> {
  switch (getProvider()) {
    case "local":
      return listLocalFiles(actor, options);
    case "s3":
      return listS3Files(actor, options);
    default:
      return listSupabaseFiles(actor, options);
  }
}

export async function createDownloadUrl(
  actor: FileActor,
  fileId: string,
): Promise<CreateDownloadUrlResult> {
  switch (getProvider()) {
    case "local":
      return createLocalDownloadUrl(actor, fileId);
    case "s3":
      return createS3DownloadUrl(actor, fileId);
    default:
      return createSupabaseDownloadUrl(actor, fileId);
  }
}

export async function deleteFile(actor: FileActor, fileId: string) {
  switch (getProvider()) {
    case "local":
      return deleteLocalFile(actor, fileId);
    case "s3":
      return deleteS3File(actor, fileId);
    default:
      return deleteSupabaseFile(actor, fileId);
  }
}

export async function uploadFileContent(
  actor: FileActor,
  fileId: string,
  token: string,
  bytes: Uint8Array,
  mimeType: string | null,
) {
  if (getProvider() !== "local") {
    throw new Error("Direct upload endpoint is only available for the local file provider.");
  }

  return performLocalUpload(actor, fileId, token, bytes, mimeType);
}

export async function downloadFileContent(actor: FileActor, fileId: string, token: string) {
  if (getProvider() !== "local") {
    throw new Error("Direct download endpoint is only available for the local file provider.");
  }

  return streamLocalDownload(actor, fileId, token);
}
