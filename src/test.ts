/**
 * test.ts
 *
 * Quick local test — creates a sample email and pushes it to
 * a filesystem sync target (no cloud credentials needed).
 */

import { emailToNote } from "./emailToNote";
import { EmailPayload, ServiceConfig } from "./types";

async function test() {
  console.log("🧪 Running local test...\n");

  const sampleEmail: EmailPayload = {
    subject: "Meeting Notes - Q1 Planning",
    body: "Hi team,\n\nPlease review the Q1 roadmap attached.\n\nBest,\nAlice",
    htmlBody: `
      <h1>Meeting Notes</h1>
      <p>Hi team,</p>
      <p>Please review the <strong>Q1 roadmap</strong> attached.</p>
      <ul>
        <li>Revenue targets</li>
        <li>Hiring plan</li>
        <li>Product milestones</li>
      </ul>
      <p>Best,<br/>Alice</p>
    `,
    from: "alice@example.com",
    to: "notes@example.com",
    date: new Date().toISOString(),
    attachments: [],
  };

  // Use filesystem sync target for testing (no cloud creds needed)
  const config: ServiceConfig = {
    syncTarget: "JoplinServer",
    joplinServerUrl: process.env.JOPLIN_SERVER_URL || "http://localhost:22300",
    joplinServerUsername: process.env.JOPLIN_SERVER_USERNAME || "admin@localhost",
    joplinServerPassword: process.env.JOPLIN_SERVER_PASSWORD || "admin",
    parentFolderId: "",
  };

  console.log("📧 Sample email:");
  console.log(`   Subject: ${sampleEmail.subject}`);
  console.log(`   From:    ${sampleEmail.from}`);
  console.log(`   Date:    ${sampleEmail.date}\n`);

  const result = await emailToNote(sampleEmail, config);

  console.log(`\n✅ Test passed!`);
  console.log(`   Note ID:      ${result.noteId}`);
  console.log(`   Attachments:  ${result.resourceIds.length}`);
}

test().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
