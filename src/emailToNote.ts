/**
 * emailToNote.ts
 *
 * Core logic: converts an EmailPayload into Joplin note items
 * and writes them to cloud storage via joplin-sync-lib's StorageAPI.
 */

import {
  StorageAPI,
  createNote,
  createResource,
  createFolder,
} from "joplin-sync";
import { EmailPayload, ServiceConfig } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal HTML-to-markdown conversion (no external deps) */
function htmlToMarkdown(html: string): string {
  let md = html;
  // Strip <style> and <script> blocks
  md = md.replace(/<style[\s\S]*?<\/style>/gi, "");
  md = md.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  // Bold, italic
  md = md.replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)>(.*?)<\/\1>/gi, "*$2*");
  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  // Images
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, "![]($1)");
  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<p[^>]*>/gi, "");
  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");
  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content
      .split("\n")
      .map((line: string) => `> ${line}`)
      .join("\n");
  });
  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, " ");
  // Collapse excessive blank lines
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

/** Build note body from email */
function buildNoteBody(email: EmailPayload): string {
  const parts: string[] = [];

  // Metadata header
  parts.push(`**From:** ${email.from}`);
  parts.push(`**To:** ${email.to}`);
  parts.push(`**Date:** ${email.date}`);
  parts.push("---");
  parts.push("");

  // Body content (prefer HTML conversion, fall back to plain text)
  if (email.htmlBody) {
    parts.push(htmlToMarkdown(email.htmlBody));
  } else {
    parts.push(email.body);
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Storage API initializer
// ---------------------------------------------------------------------------

function createStorageAPI(config: ServiceConfig): StorageAPI {
  switch (config.syncTarget) {
    case "JoplinServer":
      return new StorageAPI("JoplinServer", {
        joplinServerOptions: {
          username: config.joplinServerUsername || "",
          password: config.joplinServerPassword || "",
          path: config.joplinServerUrl || "",
          userContentPath: config.joplinServerUrl || "",
        },
      });

    case "WebDAV":
      return new StorageAPI("WebDAV", {
        webDAVOptions: {
          username: config.webdavUsername || "",
          password: config.webdavPassword || "",
          path: config.webdavUrl || "",
        },
      });

    case "OneDrive":
      return new StorageAPI("OneDrive", {
        oneDriveOptions: {
          clientId: config.onedriveClientId,
          clientSecret: config.onedriveClientSecret,
          authToken: config.onedriveAuthToken,
        },
      });

    case "GoogleDrive":
      return new StorageAPI("GoogleDrive", {
        googleDriveOptions: {
          clientId: config.googledriveClientId,
          clientSecret: config.googledriveClientSecret,
          authToken: config.googledriveAuthToken,
        },
      });

    default:
      throw new Error(`Unsupported sync target: ${config.syncTarget}`);
  }
}

// ---------------------------------------------------------------------------
// Main conversion function
// ---------------------------------------------------------------------------

/**
 * Convert an email payload into Joplin items and push to cloud storage.
 *
 * @returns The IDs of the created items
 */
export async function emailToNote(
  email: EmailPayload,
  config: ServiceConfig
): Promise<{ noteId: string; resourceIds: string[] }> {
  const storage = createStorageAPI(config);
  await storage.init();

  const items: any[] = [];
  const resourceIds: string[] = [];

  // --- Build note ---
  let body = buildNoteBody(email);

  // --- Handle attachments (create resources) ---
  if (email.attachments && email.attachments.length > 0) {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");

    for (const attachment of email.attachments) {
      // Write base64 content to a temp file so joplin-sync-lib can upload it
      const tmpDir = os.tmpdir();
      const tmpPath = path.join(tmpDir, `joplin-email-${Date.now()}-${attachment.filename}`);
      const buffer = Buffer.from(attachment.contentBase64, "base64");
      fs.writeFileSync(tmpPath, buffer);

      const resource = createResource({
        localResourceContentPath: tmpPath,
        title: attachment.filename,
      });

      // Append resource link to note body
      body += `\n\n[${attachment.filename}](:/${resource.id})`;

      items.push(resource);
      resourceIds.push(resource.id);
    }
  }

  // --- Create note ---
  const note = createNote({
    title: email.subject || "(No Subject)",
    body,
    parent_id: config.parentFolderId || "",
  });
  items.push(note);

  // --- Push to cloud storage ---
  await storage.createItems(items);

  console.log(`✅ Created note "${note.title}" (${note.id}) with ${resourceIds.length} attachment(s)`);

  return { noteId: note.id, resourceIds };
}

export { createStorageAPI, buildNoteBody, htmlToMarkdown };
