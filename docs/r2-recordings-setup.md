# Cloudflare R2 for CRM screen recordings

Online recorder clips use **Cloudflare R2** (10 GB free storage, free egress) when configured.
Supabase still holds **auth + metadata** (`crm_recordings`). Without R2 env vars, uploads fall back to Supabase Storage (Free = **50 MB/file**).

## 1. Create the bucket

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage**
2. **Create bucket** — name e.g. `crm-screen-recordings` (private; no public access)
3. Note your **Account ID** (R2 overview sidebar)

## 2. API token

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Permissions: **Object Read & Write** on that bucket (or account)
3. Copy **Access Key ID** and **Secret Access Key** (shown once)

## 3. CORS (required for browser PUT uploads)

R2 → your bucket → **Settings** → **CORS policy** → paste:

```json
[
  {
    "AllowedOrigins": [
      "https://iobjectm.com",
      "https://www.iobjectm.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add any `*.vercel.app` preview origins you use for testing.

## 4. Vercel env vars

Project → **Settings** → **Environment Variables** (Production + Preview):

| Name | Value |
|------|--------|
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | `crm-screen-recordings` (or your bucket name) |

Redeploy after saving (`npm run deploy`).

Local `.env` / `.env.local` can use the same names for `vercel dev`.

## 5. Verify

1. Open live CRM → Recorder → record a short clip → **Save online**
2. Or call `GET /api/crm-recorder?action=r2-status` → `{ "enabled": true, ... }`
3. File appears under Online library; share link `/r/{slug}` still works

Soft max per upload in the app: **512 MB** (R2 free tier is 10 GB **total**).

## Notes

- Old clips already in Supabase Storage keep working (playback tries R2 first, then Supabase).
- New uploads go to R2 when env is set.
- Do **not** put R2 secrets in `VITE_*` vars (browser-visible).
