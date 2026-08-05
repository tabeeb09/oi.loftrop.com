import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
const outDir = path.join(process.cwd(), ".codex-test-artifacts");
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

if (!executablePath) {
  console.error("No local Chrome/Edge executable was found for Playwright.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const user1 = { username: "localtester@example.com", password: "LocalTest123!" };
const user2 = { username: "localtester2@example.com", password: "LocalTest456!" };
const runId = `${Date.now()}`;
const user1File1Name = `user1-first-${runId}.txt`;
const user1File2Name = `user1-second-${runId}.txt`;
const user2File1Name = `user2-first-${runId}.txt`;
const user2File2Name = `user2-second-${runId}.txt`;
const user1File1 = path.join(outDir, user1File1Name);
const user1File2 = path.join(outDir, user1File2Name);
const user2File1 = path.join(outDir, user2File1Name);
const user2File2 = path.join(outDir, user2File2Name);
fs.writeFileSync(user1File1, "user1 first file");
fs.writeFileSync(user1File2, "user1 second file");
fs.writeFileSync(user2File1, "user2 first file");
fs.writeFileSync(user2File2, "user2 second file");

async function login(page, creds) {
  await page.goto(`${baseUrl}/api/auth/signin?callbackUrl=%2Ffiles`, { waitUntil: "networkidle" });
  await page.getByText("Keycloak", { exact: false }).first().click();

  await Promise.race([
    page.waitForURL(/(127\\.0\\.0\\.1|localhost):8080/, { timeout: 30000 }),
    page.waitForURL(/\/files$/, { timeout: 30000 }),
  ]);

  if (/(127\\.0\\.0\\.1|localhost):8080/.test(page.url())) {
    await page.locator("#username").fill(creds.username);
    await page.locator("#password").fill(creds.password);
    await page.getByRole("button", { name: /sign in/i }).click();
  }

  await page.waitForURL(/\/files$/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: /user files/i }).waitFor({ timeout: 10000 });
}

async function logout(page) {
  await page.goto(`${baseUrl}/api/auth/signout?callbackUrl=%2F`, { waitUntil: "networkidle" });
  const signOutButton = page.getByRole("button", { name: /sign out/i });

  if (await signOutButton.count()) {
    await signOutButton.click();
    await page.waitForLoadState("networkidle");
  }
}

async function uploadViaUi(page, filePath) {
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(filePath);
  await page.getByRole("button", { name: /^Upload$/i }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^Upload$/i }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

async function deleteByFilename(page, filename) {
  const row = page.locator("tbody tr").filter({ hasText: filename }).first();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/files/") &&
        response.request().method() === "DELETE" &&
        response.status() === 200,
    ),
    row.getByRole("button", { name: /^Delete$/i }).click(),
  ]);
  await row.waitFor({ state: "detached", timeout: 10000 });
}

async function listFiles(page, ownerSub = null) {
  return page.evaluate(async (ownerSubArg) => {
    const url = ownerSubArg ? `/api/files?ownerSub=${encodeURIComponent(ownerSubArg)}` : "/api/files";
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json();
    return { status: response.status, payload };
  }, ownerSub);
}

async function downloadUrl(page, fileId) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/files/${encodeURIComponent(id)}/download-url`, {
      cache: "no-store",
    });
    const payload = await response.json();
    return { status: response.status, payload };
  }, fileId);
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath });

  try {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await login(page1, user1);
    await uploadViaUi(page1, user1File1);
    let list = await listFiles(page1);

    if (list.status !== 200 || !Array.isArray(list.payload.files) || !list.payload.files.some((f) => f.originalFilename === user1File1Name)) {
      throw new Error(`User1 first upload not visible: ${JSON.stringify(list)}`);
    }

    await deleteByFilename(page1, user1File1Name);
    list = await listFiles(page1);

    if (list.payload.files.some((f) => f.originalFilename === user1File1Name)) {
      throw new Error("User1 first file still present after delete");
    }

    await uploadViaUi(page1, user1File2);
    list = await listFiles(page1);
    const user1Second = list.payload.files.find((f) => f.originalFilename === user1File2Name);

    if (!user1Second) {
      throw new Error(`User1 second upload missing: ${JSON.stringify(list)}`);
    }

    const user1FileId = user1Second.id;
    const user1OwnerSub = user1Second.ownerSub;

    await logout(page1);
    await context1.close();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await login(page2, user2);
    await uploadViaUi(page2, user2File1);
    list = await listFiles(page2);

    if (list.status !== 200 || !list.payload.files.some((f) => f.originalFilename === user2File1Name)) {
      throw new Error(`User2 first upload not visible: ${JSON.stringify(list)}`);
    }

    if (list.payload.files.some((f) => f.id === user1FileId || f.originalFilename === user1File2Name)) {
      throw new Error(`User2 can see user1 file in own listing: ${JSON.stringify(list)}`);
    }

    await deleteByFilename(page2, user2File1Name);
    list = await listFiles(page2);

    if (list.payload.files.some((f) => f.originalFilename === user2File1Name)) {
      throw new Error("User2 first file still present after delete");
    }

    await uploadViaUi(page2, user2File2);
    list = await listFiles(page2);
    const user2Second = list.payload.files.find((f) => f.originalFilename === user2File2Name);

    if (!user2Second) {
      throw new Error(`User2 second upload missing: ${JSON.stringify(list)}`);
    }

    const forgedList = await listFiles(page2, user1OwnerSub);

    if (forgedList.status !== 200) {
      throw new Error(`Unexpected status for forged ownerSub list: ${JSON.stringify(forgedList)}`);
    }

    if (forgedList.payload.files.some((f) => f.id === user1FileId || f.originalFilename === user1File2Name)) {
      throw new Error(`User2 ownerSub query leaked user1 files: ${JSON.stringify(forgedList)}`);
    }

    const foreignDownload = await downloadUrl(page2, user1FileId);

    if (foreignDownload.status !== 403) {
      throw new Error(`Expected 403 for foreign download-url, got ${JSON.stringify(foreignDownload)}`);
    }

    await logout(page2);
    await context2.close();

    console.log(
      JSON.stringify(
        {
          ok: true,
          providerTested: process.env.FILE_STORAGE_PROVIDER || "s3",
          user1FileId,
          user1OwnerSub,
          user2FileId: user2Second.id,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

