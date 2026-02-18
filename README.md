# 📧 Joplin Self-hosted Email-to-Note

**Self-hosted, serverless email-to-Joplin using GitHub Actions + [joplin-sync-lib](https://github.com/khuongduy354/joplin-sync-lib).**

Forward emails to your Joplin notes without subscribing to Joplin Cloud — route emails through a GitHub Action that writes directly to your cloud storage.

```
┌──────────────┐     ┌─────────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ Email Source │────→│ Trigger (pick one)  │────→│   GitHub Action   │────→│  Cloud Storage  │
│ (Gmail etc.) │     │ • Google Apps Script│     │    (this repo)    │     │ • Joplin Server │
└──────────────┘     │ • Zapier webhook    │     │  joplin-sync-lib  │     │ • WebDAV        │
                     │ • curl / any HTTP   │     └───────────────────┘     │ • OneDrive      │
                     └─────────────────────┘                               │ • Google Drive  │
                                                                           └─────────────────┘
```

## Features

- **Zero server** — runs as GitHub Actions (free tier = 2,000 min/month)
- **Any Joplin sync target** — Joplin Server, WebDAV, OneDrive, Google Drive
- **Attachments** — images, PDFs, docs are synced as Joplin resources
- **HTML → Markdown** — email HTML is converted to clean markdown
- **Config UI** — browser-based wizard to generate your GitHub Secrets
- **Prebuilt Google Apps Script** — drop-in Gmail → GitHub Action forwarder
- **Zapier guide** — step-by-step webhook integration

---

## Quick Start

### 1. Fork / Clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/joplin-email-to-note.git
cd joplin-email-to-note
npm install
```

### 2. Configure via the UI

Open **[`docs/config-ui.html`](docs/config-ui.html)** in your browser and follow the 3-step wizard:

1. Choose your sync target (Joplin Server, WebDAV, OneDrive, Google Drive)
2. Enter your credentials
3. Copy the generated GitHub Secrets

### 3. Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** and add each secret from the UI.

### 4. Set up an email trigger

Choose one:

| Method | Difficulty | Link |
|--------|-----------|------|
| **Google Apps Script** | Easy | [`scripts/google-apps-script.js`](scripts/google-apps-script.js) |
| **Zapier** | Easy | [`docs/zapier-integration.md`](docs/zapier-integration.md) |
| **curl / HTTP** | Any | See [Manual Trigger](#manual-trigger) below |

### 5. Done! 

New emails will appear as notes in Joplin after your next sync.

---

## 📡 Sync Targets

### Joplin Server (recommended)

Simple username/password auth. Works with both self-hosted Joplin Server and Joplin Cloud.

```
SYNC_TARGET=JoplinServer
JOPLIN_SERVER_URL=https://your-joplin-server.com
JOPLIN_SERVER_USERNAME=user@email.com
JOPLIN_SERVER_PASSWORD=yourpassword
```

### WebDAV (Nextcloud, ownCloud)

Simple username/password auth. Compatible with any WebDAV server.

```
SYNC_TARGET=WebDAV
WEBDAV_URL=https://nextcloud.example.com/remote.php/dav/files/user/Joplin
WEBDAV_USERNAME=your_username
WEBDAV_PASSWORD=your_password
```

### OneDrive

> ⚠️ **Requires OAuth.** OneDrive uses Microsoft's OAuth 2.0 flow — there is no username/password option. You must register an Azure app and complete the OAuth flow once to get tokens.

```
SYNC_TARGET=OneDrive
ONEDRIVE_CLIENT_ID=your_azure_app_client_id
ONEDRIVE_CLIENT_SECRET=your_azure_app_client_secret
ONEDRIVE_AUTH_TOKEN={"access_token":"...","refresh_token":"..."}
```

See [joplin-sync-lib OneDrive docs](https://github.com/khuongduy354/joplin-sync-lib) for the OAuth setup.

### Google Drive

> ⚠️ **Requires OAuth.** Similar to OneDrive — register a Google Cloud project and run the OAuth flow once.

```
SYNC_TARGET=GoogleDrive
GOOGLEDRIVE_CLIENT_ID=your_client_id
GOOGLEDRIVE_CLIENT_SECRET=your_client_secret
GOOGLEDRIVE_AUTH_TOKEN={"access_token":"...","refresh_token":"..."}
```

---

## 📨 Email Triggers

### Google Apps Script (recommended)

A complete, ready-to-use script that polls Gmail and sends matching emails to GitHub Actions.

1. Go to [script.google.com](https://script.google.com) → New Project
2. Paste the contents of [`scripts/google-apps-script.js`](scripts/google-apps-script.js)
3. Edit the `CONFIG` object at the top with your GitHub repo and token
4. Run `setup()` once to create the polling trigger
5. Label emails with `to-joplin` and they'll be forwarded automatically

### Zapier

See the full guide: **[`docs/zapier-integration.md`](docs/zapier-integration.md)**

### Manual Trigger

Test with `curl`:

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer ghp_YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/YOUR_USERNAME/joplin-email-to-note/dispatches \
  -d '{
    "event_type": "email-to-note",
    "client_payload": {
      "email": {
        "subject": "Meeting Notes",
        "body": "Discussed Q1 roadmap...",
        "from": "alice@example.com",
        "to": "notes@example.com",
        "date": "2026-02-13T10:00:00Z",
        "attachments": []
      }
    }
  }'
```

Or use **workflow_dispatch** from the GitHub Actions UI for quick testing.

---

## 🧪 Local Testing

```bash
# Against a local Joplin Server
cp .env.example .env
# Edit .env with your credentials
npm run test
```

Or pipe JSON directly:

```bash
echo '{"subject":"Test","body":"Hello","from":"a@b.com","to":"c@d.com","date":"2026-01-01T00:00:00Z"}' | npm start
```

---

## 📁 Project Structure

```
joplin-email-to-note/
├── .github/workflows/
│   └── email-to-note.yml      # GitHub Action workflow
├── src/
│   ├── types.ts                # Email payload & config types
│   ├── emailToNote.ts          # Core conversion logic
│   ├── index.ts                # CLI / GitHub Action entry point
│   └── test.ts                 # Local test script
├── scripts/
│   └── google-apps-script.js   # Gmail → GitHub Action forwarder
├── docs/
│   ├── config-ui.html          # Browser-based config wizard
│   └── zapier-integration.md   # Zapier setup guide
├── .env.example                # Environment variable template
├── package.json
└── README.md
```

---

## 📋 Email Payload Format

All triggers send this JSON structure:

```typescript
interface EmailPayload {
  subject: string;        // → Note title
  body: string;           // → Note body (plain text)
  htmlBody?: string;      // → Converted to markdown (preferred)
  from: string;           // → Shown in note metadata
  to: string;
  date: string;           // ISO 8601
  attachments?: Array<{
    filename: string;
    mimeType: string;
    contentBase64: string; // Base64-encoded file
  }>;
}
```

---

## FAQ

**Q: Is OneDrive possible without OAuth?**
A: No. Microsoft requires OAuth 2.0 for all OneDrive API access. However, you only need to run the OAuth flow **once** to get a refresh token — the sync lib handles automatic token refresh after that.

**Q: How much does this cost?**
A: GitHub Actions free tier gives you 2,000 minutes/month. A typical email-to-note run takes ~30 seconds. So you can run it up to 400 times/month for free.

**Q: What about rate limits?**
A: GitHub's repository_dispatch API allows 5,000 requests/hour per token. The Google Apps Script polls every 5 minutes by default.

---

## 🔗 Related

- [joplin-sync-lib](https://github.com/khuongduy354/joplin-sync-lib) — The sync library powering this project
- [Joplin](https://joplinapp.org/) — The open-source note-taking app
<!-- - [Joplin Forum - Email to Note Discussion](https://discourse.joplinapp.org/) -->

## 📄 License

MIT
