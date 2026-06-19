import fs from "node:fs/promises";
import { accessSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getPythonCommand } from "./pythonRuntime.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_CANDIDATES = [
  path.resolve(currentDir, "..", "orca_3mf_filament_report.py"),
  path.resolve(currentDir, "..", "..", "orca_3mf_filament_report.py"),
];

function getScriptPath() {
  for (const candidate of SCRIPT_CANDIDATES) {
    try {
      accessSync(candidate);
      return candidate;
    } catch {}
  }

  return SCRIPT_CANDIDATES[0];
}

function runPython(args) {
  return new Promise((resolve, reject) => {
    const runtime = getPythonCommand();
    const child = spawn(runtime.command, [...runtime.baseArgs, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
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
    const raw = await runPython([getScriptPath(), tempFile, "--json"]);
    const parsed = JSON.parse(raw);
    const extractedType =
      parsed?.slice_info_stats?.filament_type ||
      parsed?.slice_info_stats?.filaments?.find?.((entry) => entry?.type)?.type ||
      null;
    const gramCandidates = [
      parsed?.octoprint_analysis?.grams_from_volume,
      parsed?.embedded_gcode_stats?.grams_from_volume,
      parsed?.embedded_gcode_stats?.grams_from_length,
      parsed?.manual_gcode_analysis?.total_grams,
      parsed?.slice_info_stats?.used_g,
    ];
    const grams =
      gramCandidates.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ??
      gramCandidates.find((value) => typeof value === "number" && Number.isFinite(value)) ??
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
