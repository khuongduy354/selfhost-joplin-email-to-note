/**
 * Email payload types for the Joplin Email-to-Note service.
 *
 * These types define the contract between email forwarders
 * (Google Apps Script, Zapier, etc.) and this service.
 */

/** A single email attachment */
export interface EmailAttachment {
  /** Original filename (e.g. "report.pdf") */
  filename: string;
  /** MIME type (e.g. "application/pdf") */
  mimeType: string;
  /** Base64-encoded file content */
  contentBase64: string;
}

/** The email payload sent to the GitHub Action / serverless handler */
export interface EmailPayload {
  /** Email subject line → becomes note title */
  subject: string;
  /** Email body as plain text */
  body: string;
  /** Email body as HTML (optional, will be converted to markdown) */
  htmlBody?: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** ISO 8601 timestamp when the email was received */
  date: string;
  /** File attachments (optional) */
  attachments?: EmailAttachment[];
}

/** Supported sync target types */
export type SyncTargetType =
  | "JoplinServer"
  | "WebDAV"
  | "OneDrive"
  | "GoogleDrive";

/** Configuration for the email-to-note service */
export interface ServiceConfig {
  syncTarget: SyncTargetType;
  /** Parent folder ID in Joplin for new notes */
  parentFolderId?: string;

  // Joplin Server
  joplinServerUrl?: string;
  joplinServerUsername?: string;
  joplinServerPassword?: string;

  // WebDAV
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;

  // OneDrive
  onedriveClientId?: string;
  onedriveClientSecret?: string;
  onedriveAuthToken?: string;

  // Google Drive
  googledriveClientId?: string;
  googledriveClientSecret?: string;
  googledriveAuthToken?: string;
}
