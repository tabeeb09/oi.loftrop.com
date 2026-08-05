"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { StoredFile } from "@/src/lib/files/types";

type FileListResponse = {
  files: StoredFile[];
  nextCursor: string | null;
  quota: {
    usedBytes: number;
    maxBytes: number;
    remainingBytes: number;
  };
};

type Props = {
  acceptedExtensions: string[];
};

function formatBytes(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function FileManager({ acceptedExtensions }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [quota, setQuota] = useState<FileListResponse["quota"] | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);

  async function loadFiles(cursor?: string | null, append = false) {
    setLoading(true);
    setError(null);

    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/files${query}`, { cache: "no-store" });
      const payload = (await response.json()) as FileListResponse | { error?: string };

      if (!response.ok || !("files" in payload)) {
        throw new Error(payload.error || "Failed to load files.");
      }

      setFiles((current) => (append ? [...current, ...payload.files] : payload.files));
      setNextCursor(payload.nextCursor);
      setQuota(payload.quota);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  const selectedSummary = useMemo(() => {
    if (!selectedFile) {
      return "No file chosen";
    }

    return `${selectedFile.name} (${formatBytes(selectedFile.size)})`;
  }, [selectedFile]);

  const acceptedTypesLabel = useMemo(
    () => acceptedExtensions.map((value) => value.replace(/^\./, "")).join(", ").toUpperCase(),
    [acceptedExtensions],
  );

  const acceptValue = useMemo(() => acceptedExtensions.join(","), [acceptedExtensions]);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0] ?? selectedFile;

    if (!file) {
      setError("Choose a file before uploading.");
      return;
    }

    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : "";

    if (acceptedExtensions.length && !acceptedExtensions.includes(extension)) {
      setQuotaWarning(`Only these file types are allowed: ${acceptedTypesLabel}.`);
      return;
    }

    if (quota && file.size > quota.remainingBytes) {
      setQuotaWarning(
        `Upload limit exceeded. File size is ${formatBytes(file.size)} but only ${formatBytes(quota.remainingBytes)} remains.`,
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || undefined,
          sizeBytes: file.size,
        }),
      });
      const payload =
        (await response.json()) as
          | {
              uploadUrl: string;
              uploadMethod: "PUT";
              uploadHeaders: Record<string, string>;
            }
          | { error?: string };

      if (!response.ok || !("uploadUrl" in payload)) {
        const message = payload.error || "Failed to create upload URL.";
        if (message.toLowerCase().includes("upload limit exceeded")) {
          setQuotaWarning(message);
        }
        throw new Error(message);
      }

      const uploadResponse = await fetch(payload.uploadUrl, {
        method: payload.uploadMethod,
        headers: payload.uploadHeaders,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed (${uploadResponse.status}).`);
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadFiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(fileId: string) {
    setDownloadingId(fileId);
    setError(null);

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download-url`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { downloadUrl?: string; error?: string };

      if (!response.ok || !payload.downloadUrl) {
        throw new Error(payload.error || "Failed to create download URL.");
      }

      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(fileId: string) {
    setDeletingId(fileId);
    setError(null);

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete file.");
      }

      setFiles((current) => current.filter((file) => file.id !== fileId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          padding: "1rem",
          background: "#fff",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Upload file</h2>
        {quota ? (
          <p style={{ margin: 0, color: "#555" }}>
            Used {formatBytes(quota.usedBytes)} of {formatBytes(quota.maxBytes)}. Remaining{" "}
            <strong>{formatBytes(quota.remainingBytes)}</strong>.
          </p>
        ) : null}
        <p style={{ margin: 0, color: "#555" }}>Allowed file types: {acceptedTypesLabel}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptValue}
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          disabled={loading}
        />
        <p style={{ margin: 0, color: "#555" }}>{selectedSummary}</p>
        <div>
          <button type="button" onClick={handleUpload} disabled={!selectedFile || loading}>
            {loading ? "Working..." : "Upload"}
          </button>
        </div>
        {error ? <p style={{ margin: 0, color: "#a40000" }}>{error}</p> : null}
      </section>

      {quotaWarning ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "min(30rem, 100%)",
              padding: "1rem",
              border: "1px solid rgba(0,0,0,0.15)",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Upload blocked</h2>
            <p style={{ margin: 0 }}>{quotaWarning}</p>
            <div>
              <button type="button" onClick={() => setQuotaWarning(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          padding: "1rem",
          background: "#fff",
          overflowX: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Your files</h2>
          <button type="button" onClick={() => loadFiles()} disabled={loading}>
            Reload
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Filename</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Size</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Created</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.length ? (
              files.map((file) => (
                <tr key={file.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <td style={{ padding: "0.65rem 0" }}>{file.originalFilename}</td>
                  <td style={{ padding: "0.65rem 0" }}>{formatBytes(file.sizeBytes)}</td>
                  <td style={{ padding: "0.65rem 0", textTransform: "capitalize" }}>{file.status}</td>
                  <td style={{ padding: "0.65rem 0" }}>{formatDate(file.createdAt)}</td>
                  <td style={{ padding: "0.65rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleDownload(file.id)}
                      disabled={downloadingId === file.id}
                    >
                      {downloadingId === file.id ? "Preparing..." : "Download"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(file.id)}
                      disabled={deletingId === file.id}
                    >
                      {deletingId === file.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: "0.9rem 0", color: "#666" }}>
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {nextCursor ? (
          <div style={{ marginTop: "1rem" }}>
            <button type="button" onClick={() => loadFiles(nextCursor, true)} disabled={loading}>
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
