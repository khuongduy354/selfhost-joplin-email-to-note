/**
 * ============================================================================
 * Google Apps Script — Email to Joplin Note Forwarder
 * ============================================================================
 *
 * This script runs inside Google Apps Script (https://script.google.com)
 * and forwards new emails to your GitHub Actions workflow, which then
 * creates notes in Joplin via joplin-sync-lib.
 *
 * SETUP:
 *   1. Go to https://script.google.com → New Project
 *   2. Paste this entire file into Code.gs
 *   3. Set the CONFIG values below
 *   4. Run `setup()` once to create the time-based trigger
 *   5. Authorize the script when prompted
 *
 * HOW IT WORKS:
 *   - A time-based trigger runs `checkForNewEmails()` every N minutes
 *   - It searches Gmail for emails matching your query (e.g. label:to-joplin)
 *   - For each matching email, it sends the content to GitHub Actions
 *     via the repository_dispatch API
 *   - After processing, the label is removed (or the email is marked read)
 *
 * GITHUB TOKEN:
 *   - Go to https://github.com/settings/tokens → Generate new token (classic)
 *   - Scope: `repo` (to trigger workflow_dispatch)
 *   - Copy the token and paste it below
 * ============================================================================
 */

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const CONFIG = {
  // Your GitHub repo (owner/repo)
  GITHUB_REPO: "YOUR_USERNAME/joplin-email-to-note",

  // GitHub Personal Access Token (with `repo` scope)
  GITHUB_TOKEN: "ghp_YOUR_TOKEN_HERE",

  // Gmail search query — emails matching this will be forwarded
  // Examples:
  //   "label:to-joplin"           → emails with the "to-joplin" label
  //   "to:joplin@yourdomain.com"  → emails sent to a specific address
  //   "is:unread label:notes"     → unread emails with "notes" label
  GMAIL_QUERY: "label:to-joplin is:unread",

  // After forwarding, should we remove the label or just mark as read?
  // Options: "mark_read" | "remove_label" | "archive" | "trash"
  AFTER_ACTION: "mark_read",

  // If using "remove_label", which label to remove
  LABEL_TO_REMOVE: "to-joplin",

  // Maximum emails to process per run (to avoid timeout)
  MAX_EMAILS_PER_RUN: 10,

  // Include attachments? (increases payload size)
  INCLUDE_ATTACHMENTS: true,

  // Max attachment size in bytes (5MB default — GitHub has payload limits)
  MAX_ATTACHMENT_SIZE: 5 * 1024 * 1024,
};

// ─── MAIN FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Run this ONCE to set up the time-based trigger.
 * Menu: Run → setup
 */
function setup() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  // Create a new trigger that runs every 5 minutes
  ScriptApp.newTrigger("checkForNewEmails")
    .timeDriven()
    .everyMinutes(5)
    .create();

  Logger.log("✅ Trigger created! checkForNewEmails will run every 5 minutes.");
  Logger.log("📝 Make sure you've set the CONFIG values in the script.");
}

/**
 * Main function — called by the time-based trigger.
 * Searches Gmail, extracts email content, sends to GitHub Actions.
 */
function checkForNewEmails() {
  Logger.log("🔍 Searching for emails: " + CONFIG.GMAIL_QUERY);

  const threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, CONFIG.MAX_EMAILS_PER_RUN);

  if (threads.length === 0) {
    Logger.log("📭 No matching emails found.");
    return;
  }

  Logger.log(`📬 Found ${threads.length} thread(s) to process.`);

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      if (message.isUnread() || CONFIG.AFTER_ACTION !== "mark_read") {
        try {
          processEmail(message);
        } catch (error) {
          Logger.log(`❌ Error processing email "${message.getSubject()}": ${error}`);
        }
      }
    }

    // Post-processing action
    applyAfterAction(thread);
  }

  Logger.log("✅ Done processing emails.");
}

/**
 * Process a single email message — extract content and send to GitHub.
 */
function processEmail(message) {
  const subject = message.getSubject();
  Logger.log(`📧 Processing: "${subject}"`);

  // Build the email payload
  const emailPayload = {
    subject: subject,
    body: message.getPlainBody(),
    htmlBody: message.getBody(),
    from: message.getFrom(),
    to: message.getTo(),
    date: message.getDate().toISOString(),
    attachments: [],
  };

  // Handle attachments
  if (CONFIG.INCLUDE_ATTACHMENTS) {
    const attachments = message.getAttachments();
    for (const att of attachments) {
      if (att.getSize() <= CONFIG.MAX_ATTACHMENT_SIZE) {
        emailPayload.attachments.push({
          filename: att.getName(),
          mimeType: att.getContentType(),
          contentBase64: Utilities.base64Encode(att.getBytes()),
        });
        Logger.log(`  📎 Attachment: ${att.getName()} (${att.getSize()} bytes)`);
      } else {
        Logger.log(`  ⚠️ Skipping large attachment: ${att.getName()} (${att.getSize()} bytes)`);
      }
    }
  }

  // Send to GitHub Actions via repository_dispatch
  triggerGitHubAction(emailPayload);
}

/**
 * Trigger the GitHub Actions workflow via repository_dispatch API.
 */
function triggerGitHubAction(emailPayload) {
  const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/dispatches`;

  const payload = {
    event_type: "email-to-note",
    client_payload: {
      email: emailPayload,
    },
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code === 204) {
    Logger.log("  ✅ GitHub Action triggered successfully!");
  } else {
    Logger.log(`  ❌ GitHub API responded with ${code}: ${response.getContentText()}`);
    throw new Error(`GitHub API error: ${code}`);
  }
}

/**
 * Apply the configured post-processing action to a Gmail thread.
 */
function applyAfterAction(thread) {
  switch (CONFIG.AFTER_ACTION) {
    case "mark_read":
      thread.markRead();
      break;
    case "remove_label":
      const label = GmailApp.getUserLabelByName(CONFIG.LABEL_TO_REMOVE);
      if (label) {
        thread.removeLabel(label);
      }
      break;
    case "archive":
      thread.moveToArchive();
      break;
    case "trash":
      thread.moveToTrash();
      break;
  }
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────

/**
 * Manually test with a fake email (run from script editor).
 */
function testWithSampleEmail() {
  const samplePayload = {
    subject: "Test Email from Google Apps Script",
    body: "This is a test email body.\n\nSent from Google Apps Script.",
    htmlBody: "<p>This is a <strong>test</strong> email body.</p><p>Sent from Google Apps Script.</p>",
    from: "test@example.com",
    to: "notes@example.com",
    date: new Date().toISOString(),
    attachments: [],
  };

  Logger.log("🧪 Sending test email to GitHub Actions...");
  triggerGitHubAction(samplePayload);
  Logger.log("✅ Test complete! Check your GitHub Actions tab.");
}
