# Zapier Integration — Email to Joplin Note

This guide shows how to set up a Zapier Zap that forwards emails to your Joplin notes via GitHub Actions.

## Architecture

```
┌──────────────┐    ┌─────────┐    ┌───────────────┐    ┌───────────────┐
│  Email Inbox │───→│  Zapier │───→│ GitHub Action  │───→│ Cloud Storage │
│ (Gmail/etc.) │    │   Zap   │    │ (this repo)    │    │ (Joplin Sync) │
└──────────────┘    └─────────┘    └───────────────┘    └───────────────┘
```

## Step-by-Step Setup

### 1. Create a New Zap

Go to [zapier.com](https://zapier.com) → **Create Zap**

### 2. Trigger: New Email

| Setting | Value |
|---------|-------|
| App | **Gmail** (or your email provider) |
| Event | **New Email** or **New Labeled Email** |
| Label | `to-joplin` (recommended) |

### 3. Action: Webhooks by Zapier

| Setting | Value |
|---------|-------|
| App | **Webhooks by Zapier** |
| Event | **Custom Request** |

### 4. Configure the Webhook

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `https://api.github.com/repos/YOUR_USERNAME/joplin-email-to-note/dispatches` |
| Data Pass-Through | No |

**Headers:**
```
Authorization: Bearer ghp_YOUR_GITHUB_TOKEN
Accept: application/vnd.github.v3+json
Content-Type: application/json
```

**Body (Raw JSON):**
```json
{
  "event_type": "email-to-note",
  "client_payload": {
    "email": {
      "subject": "{{subject}}",
      "body": "{{body_plain}}",
      "htmlBody": "{{body_html}}",
      "from": "{{from_email}}",
      "to": "{{to_email}}",
      "date": "{{date}}",
      "attachments": []
    }
  }
}
```

> **Note:** Replace `{{subject}}`, `{{body_plain}}`, etc. with the corresponding Zapier field mappings from Step 2.

### 5. Test the Zap

1. Click **Test** in Zapier
2. Check your GitHub repo → **Actions** tab
3. The workflow should run and create a note

### 6. Turn On the Zap

Once the test succeeds, turn on the Zap. New emails matching your trigger will automatically become Joplin notes!

---

## Handling Attachments

Zapier doesn't easily pass binary attachments in webhook bodies. Two workarounds:

### Option A: Skip Attachments
Leave `"attachments": []` in the body. The note will still contain the email text.

### Option B: Use a Code Step
Add a **Code by Zapier** (JavaScript) step between the trigger and the webhook:

```javascript
// Zapier Code Step — fetch attachment and base64 encode it
const attachments = [];
// inputData.attachment_url is mapped from the email trigger
if (inputData.attachment_url) {
  const response = await fetch(inputData.attachment_url);
  const buffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  attachments.push({
    filename: inputData.attachment_name || "attachment",
    mimeType: inputData.attachment_type || "application/octet-stream",
    contentBase64: base64
  });
}
output = [{ attachments: JSON.stringify(attachments) }];
```

Then use `{{attachments}}` in the webhook body.

---

## Alternative: Direct curl

You can also trigger the workflow directly with `curl`:

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer ghp_YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/YOUR_USERNAME/joplin-email-to-note/dispatches \
  -d '{
    "event_type": "email-to-note",
    "client_payload": {
      "email": {
        "subject": "Test from curl",
        "body": "Hello from the command line!",
        "from": "test@example.com",
        "to": "notes@example.com",
        "date": "2026-02-13T10:00:00Z",
        "attachments": []
      }
    }
  }'
```

A `204 No Content` response means success — check the Actions tab.
