export type StoredFileStatus = "pending" | "uploaded" | "verified" | "rejected";
export type StoredFileVisibility = "private" | "public" | "unlisted";

export type StoredFile = {
  id: string;
  ownerSub: string;
  bucket: string;
  objectKey: string;
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  status: StoredFileStatus;
  visibility: StoredFileVisibility;
  createdAt: string;
};

export type UploadUrlRequest = {
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  visibility?: StoredFileVisibility;
};

export type FileListResult = {
  files: StoredFile[];
  nextCursor: string | null;
  quota: {
    usedBytes: number;
    maxBytes: number;
    remainingBytes: number;
  };
};

export type CreateUploadUrlResult = {
  file: StoredFile;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

export type CreateDownloadUrlResult = {
  file: StoredFile;
  downloadUrl: string;
  expiresInSeconds: number;
};
