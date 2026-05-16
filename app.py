import html
import json
import re
from urllib.parse import urlparse

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FB_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "fb.watch",
    "fb.com",
    "www.fb.com",
}

DESKTOP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
}

MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.4 Mobile/15E148 Safari/604.1"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def is_facebook_url(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
        host = host.lower()
        if host in FB_HOSTS:
            return True
        return host.endswith(".facebook.com") or host.endswith(".fb.com")
    except Exception:
        return False


def _decode(value: str) -> str:
    if not value:
        return value
    try:
        decoded = bytes(value, "utf-8").decode("unicode_escape")
    except Exception:
        decoded = value
    return html.unescape(decoded).replace("\\/", "/")


def _find_all(patterns, text):
    out = []
    for pat in patterns:
        for m in re.finditer(pat, text):
            out.append(_decode(m.group(1)))
    return out


def extract_from_html(page: str):
    hd_patterns = [
        r'"browser_native_hd_url":"([^"]+)"',
        r'"playable_url_quality_hd":"([^"]+)"',
        r'hd_src_no_ratelimit:"([^"]+)"',
        r'"hd_src_no_ratelimit":"([^"]+)"',
        r'hd_src:"([^"]+)"',
        r'"hd_src":"([^"]+)"',
    ]
    sd_patterns = [
        r'"browser_native_sd_url":"([^"]+)"',
        r'"playable_url":"([^"]+)"',
        r'sd_src_no_ratelimit:"([^"]+)"',
        r'"sd_src_no_ratelimit":"([^"]+)"',
        r'sd_src:"([^"]+)"',
        r'"sd_src":"([^"]+)"',
    ]
    thumb_patterns = [
        r'"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"',
        r'"thumbnailImage":\{"uri":"([^"]+)"',
        r'<meta property="og:image" content="([^"]+)"',
    ]
    title_patterns = [
        r'<meta name="description" content="([^"]+)"',
        r'<meta property="og:title" content="([^"]+)"',
        r'<title>([^<]+)</title>',
    ]

    hd = next(iter(_find_all(hd_patterns, page)), None)
    sd = next(iter(_find_all(sd_patterns, page)), None)
    thumb = next(iter(_find_all(thumb_patterns, page)), None)
    title = next(iter(_find_all(title_patterns, page)), None)

    if not hd and not sd:
        # Last resort: any *.fbcdn.net mp4-looking URL on the page
        generic = re.findall(r'(https?:[^"\\\s]+?\.fbcdn\.net[^"\\\s]+?\.mp4[^"\\\s]*)', page)
        if generic:
            sd = _decode(generic[0])

    return {
        "hd_url": hd,
        "sd_url": sd,
        "thumbnail": thumb,
        "title": (title or "").strip() or None,
    }


def fetch_video(url: str):
    errors = []
    session = requests.Session()

    for headers in (DESKTOP_HEADERS, MOBILE_HEADERS):
        try:
            r = session.get(url, headers=headers, timeout=20, allow_redirects=True)
            r.raise_for_status()
        except requests.RequestException as e:
            errors.append(f"{headers['User-Agent'][:30]}...: {e}")
            continue

        data = extract_from_html(r.text)
        if data["hd_url"] or data["sd_url"]:
            data["source_url"] = r.url
            return data, None

    return None, "; ".join(errors) or "Could not locate any video stream in the page."


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/extract", methods=["POST"])
def api_extract():
    payload = request.get_json(silent=True) or {}
    url = (payload.get("url") or "").strip()

    if not url:
        return jsonify({"ok": False, "error": "Please paste a Facebook video or reel URL."}), 400

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    if not is_facebook_url(url):
        return jsonify({"ok": False, "error": "URL must be from facebook.com, fb.watch or fb.com."}), 400

    data, err = fetch_video(url)
    if not data:
        return jsonify({"ok": False, "error": err}), 502

    return jsonify({"ok": True, "data": data})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
