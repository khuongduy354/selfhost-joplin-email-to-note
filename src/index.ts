/**
 * index.ts
 *
 * CLI / GitHub Action entry point.
 * Reads email payload from:
 *   1. GITHUB_EVENT_PATH (workflow_dispatch / repository_dispatch)
 *   2. stdin (piped JSON)
 *   3. --payload CLI flag
 *
 * Environment variables configure the sync target (see .env.example).
 */

import * as dotenv from "dotenv";
dotenv.config();

import { emailToNote } from "./emailToNote";
import { EmailPayload, ServiceConfig, SyncTargetType } from "./types";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

function loadConfig(): ServiceConfig {
  const syncTarget = (process.env.SYNC_TARGET || "JoplinServer") as SyncTargetType;

  return {
    syncTarget,
    parentFolderId: process.env.JOPLIN_PARENT_FOLDER_ID || "",

    // Joplin Server
    joplinServerUrl: process.env.JOPLIN_SERVER_URL,
    joplinServerUsername: process.env.JOPLIN_SERVER_USERNAME,
    joplinServerPassword: process.env.JOPLIN_SERVER_PASSWORD,

    // WebDAV
    webdavUrl: process.env.WEBDAV_URL,
    webdavUsername: process.env.WEBDAV_USERNAME,
    webdavPassword: process.env.WEBDAV_PASSWORD,

    // OneDrive
    onedriveClientId: process.env.ONEDRIVE_CLIENT_ID,
    onedriveClientSecret: process.env.ONEDRIVE_CLIENT_SECRET,
    onedriveAuthToken: process.env.ONEDRIVE_AUTH_TOKEN,

    // Google Drive
    googledriveClientId: process.env.GOOGLEDRIVE_CLIENT_ID,
    googledriveClientSecret: process.env.GOOGLEDRIVE_CLIENT_SECRET,
    googledriveAuthToken: process.env.GOOGLEDRIVE_AUTH_TOKEN,
  };
}

// ---------------------------------------------------------------------------
// Payload loading
// ---------------------------------------------------------------------------

async function loadEmailPayload(): Promise<EmailPayload> {
  // 1. GitHub Actions: read from event file
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    console.log(`📂 Reading payload from GITHUB_EVENT_PATH: ${eventPath}`);
    const raw = fs.readFileSync(eventPath, "utf-8");
    const event = JSON.parse(raw);
    // repository_dispatch: payload is in client_payload
    if (event.client_payload?.email) {
      return event.client_payload.email as EmailPayload;
    }
    // workflow_dispatch: payload is in inputs.email_json
    if (event.inputs?.email_json) {
      return JSON.parse(event.inputs.email_json) as EmailPayload;
    }
    throw new Error("GitHub event file found but no email payload detected. Expected client_payload.email or inputs.email_json");
  }

  // 2. CLI: --payload flag
  const flagIdx = process.argv.indexOf("--payload");
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    const payloadPath = process.argv[flagIdx + 1];
    console.log(`📂 Reading payload from file: ${payloadPath}`);
    const raw = fs.readFileSync(payloadPath, "utf-8");
    return JSON.parse(raw) as EmailPayload;
  }

  // 3. stdin
  if (!process.stdin.isTTY) {
    console.log("📨 Reading payload from stdin...");
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => {
        try {
          resolve(JSON.parse(data) as EmailPayload);
        } catch (e) {
          reject(new Error(`Failed to parse stdin as JSON: ${e}`));
        }
      });
      process.stdin.on("error", reject);
    });
  }

  throw new Error(
    "No email payload provided. Use one of:\n" +
      "  • GITHUB_EVENT_PATH (automatic in GitHub Actions)\n" +
      "  • --payload <file.json>\n" +
      "  • echo '{...}' | npm start"
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🔄 Joplin Email-to-Note Service");
  console.log("================================\n");

  const config = loadConfig();
  console.log(`📡 Sync target: ${config.syncTarget}`);

  const email = await loadEmailPayload();
  console.log(`📧 Email: "${email.subject}" from ${email.from}\n`);

  const result = await emailToNote(email, config);
  console.log(`\n✅ Done! Note ID: ${result.noteId}`);

  if (result.resourceIds.length > 0) {
    console.log(`📎 Attachments: ${result.resourceIds.join(", ")}`);
  }

  // Write output for GitHub Actions
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `note_id=${result.noteId}\n`);
    fs.appendFileSync(outputPath, `resource_ids=${result.resourceIds.join(",")}\n`);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
