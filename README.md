# Facebook Reels & Video Downloader

A small web app for grabbing direct download links to Facebook videos, Reels,
and Watch posts.

- **Backend**: Python + Flask. Scrapes the public Facebook page HTML and
  extracts the HD/SD video URLs (`hd_src`, `sd_src`,
  `browser_native_hd_url`, etc.).
- **Frontend**: Vanilla HTML / CSS / JavaScript.
- **No proxy**: the backend only returns the direct `*.fbcdn.net` URLs.
  The browser downloads the video straight from Facebook's CDN — no bytes
  flow through this server.

## Setup

```bash
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` in your browser, paste a public Facebook video
or Reel URL, click **Fetch**, then click an HD/SD link to download.

### Batch mode (`/v2`)

Visit `/v2` for the batch UI: paste up to 20 URLs (one per line), get a
parallel fetch with a progress bar, and use **Download all HD / SD** to
trigger every download at once.

Batch API:

```bash
curl -X POST http://localhost:5000/api/extract-batch \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://fb.watch/abc...","https://www.facebook.com/reel/123..."]}'
```

## Deploy to Render

This repo is wired up for [Render](https://render.com) (free tier works).

1. Push the branch to GitHub (already done if you're reading this).
2. In Render, click **New +** → **Blueprint**, point it at this repo, and
   pick the branch `claude/fb-reels-downloader-0vOi4`.
3. Render reads `render.yaml` and provisions a web service that runs:
   ```
   gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 60
   ```
4. Wait for the build to finish and open the generated `*.onrender.com`
   URL.

Files involved in the deploy:
- `render.yaml` — Blueprint definition (runtime, build command, start command).
- `Procfile` — Same start command in Heroku/Railway format (handy if you
  later switch platforms).
- `runtime.txt` — Pins the Python version.
- `requirements.txt` — Now includes `gunicorn` for production serving.

Supported URL hosts:
- `facebook.com` / `www.facebook.com` / `m.facebook.com` / `web.facebook.com`
- `fb.watch`
- `fb.com`

## How it works

1. The frontend POSTs the URL to `/api/extract`.
2. The backend fetches the public page HTML using a desktop User-Agent
   (falls back to a mobile UA if needed).
3. It searches the HTML for known Facebook video URL fields
   (`hd_src`, `sd_src`, `browser_native_hd_url`,
   `playable_url_quality_hd`, `playable_url`, etc.) and decodes the
   escaped JSON strings.
4. It returns the direct `fbcdn.net` URLs plus a thumbnail and title.
5. The browser downloads the file via a plain `<a download>` link.

## Limitations

- Only **public** videos work. Private videos, login-walled content, and
  group-only posts cannot be retrieved.
- Facebook changes the page structure regularly; extraction patterns may
  need updates over time.
- Because the file is served by `fbcdn.net` (a different origin), some
  browsers may open the video in a new tab instead of triggering a save
  dialog. Use *right-click → Save link as…* in that case.
- Use only for content you have the right to download.
