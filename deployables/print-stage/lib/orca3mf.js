import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(currentDir, "..", "orca_3mf_filament_report.py");

function runPython(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PYTHON_BIN || "python3", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Python exited with code ${code}.`));
        return;
      }

      resolve(stdout);
    });
  });
}

export async function extractOrca3mfMetadataFromBuffer(buffer, originalFilename) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orca-3mf-"));
  const tempFile = path.join(tempDir, originalFilename || "upload.3mf");

  try {
    await fs.writeFile(tempFile, buffer);
    const raw = await runPython([SCRIPT_PATH, tempFile, "--json"]);
    const parsed = JSON.parse(raw);
    const extractedType =
      parsed?.slice_info_stats?.filament_type ||
      parsed?.slice_info_stats?.filaments?.find?.((entry) => entry?.type)?.type ||
      null;
    const grams =
      parsed?.manual_gcode_analysis?.total_grams ??
      parsed?.slice_info_stats?.used_g ??
      parsed?.embedded_gcode_stats?.grams_from_volume ??
      parsed?.embedded_gcode_stats?.grams_from_length ??
      null;

    return {
      extractionStatus: extractedType ? "verified" : "failed",
      extractedFilamentType: extractedType,
      extractedGrams: typeof grams === "number" ? grams : null,
      extractionReport: parsed,
      extractionError: extractedType ? null : "No filament type could be extracted from the file.",
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
