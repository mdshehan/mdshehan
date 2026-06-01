import html
import json
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, urlparse, urlunparse

import requests
from flask import Flask, Response, abort, jsonify, render_template, request, stream_with_context

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
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Ch-Ua": '"Chromium";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.4 Mobile/15E148 Safari/604.1"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    ),
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
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


def _strip_tracking(url: str) -> str:
    """Drop FB share-sheet tracking params that often trigger 400s."""
    p = urlparse(url)
    keep = {"v", "story_fbid", "id", "_rdr"}
    if not p.query:
        return url
    pairs = []
    for chunk in p.query.split("&"):
        if not chunk:
            continue
        k = chunk.split("=", 1)[0]
        if k in keep:
            pairs.append(chunk)
    return urlunparse((p.scheme, p.netloc, p.path, p.params, "&".join(pairs), ""))


def _rewrite_host(url: str, host: str) -> str:
    p = urlparse(url)
    return urlunparse((p.scheme or "https", host, p.path, p.params, p.query, p.fragment))


def _candidate_urls(url: str):
    """Yield URL variants to try, in order of preference.

    For facebook.com URLs we also try m.facebook.com and mbasic.facebook.com,
    which are friendlier to scraping. For short-link hosts (fb.watch, fb.com)
    we leave the URL alone and let the HTTP redirect resolve it.
    """
    cleaned = _strip_tracking(url)
    host = (urlparse(cleaned).hostname or "").lower()
    yield cleaned
    if host.endswith("facebook.com") and host != "mbasic.facebook.com":
        for alt_host in ("m.facebook.com", "mbasic.facebook.com"):
            if alt_host != host:
                yield _rewrite_host(cleaned, alt_host)


def _warm_session():
    s = requests.Session()
    try:
        s.get("https://www.facebook.com/", headers=DESKTOP_HEADERS, timeout=10)
    except requests.RequestException:
        pass
    # Force English locale; some FB endpoints 400 without it.
    s.cookies.set("locale", "en_US", domain=".facebook.com")
    s.cookies.set("wd", "1280x720", domain=".facebook.com")
    return s


def fetch_video(url: str):
    errors = []
    session = _warm_session()

    for candidate in _candidate_urls(url):
        host = urlparse(candidate).hostname or ""
        headers_list = (
            (MOBILE_HEADERS, DESKTOP_HEADERS)
            if host.startswith(("m.", "mbasic."))
            else (DESKTOP_HEADERS, MOBILE_HEADERS)
        )
        for headers in headers_list:
            try:
                r = session.get(candidate, headers=headers, timeout=20, allow_redirects=True)
                r.raise_for_status()
            except requests.RequestException as e:
                errors.append(f"{host} [{headers['User-Agent'][:18]}]: {e}")
                continue

            data = extract_from_html(r.text)
            if data["hd_url"] or data["sd_url"]:
                data["source_url"] = r.url
                return data, None

    return None, "; ".join(errors) or "Could not locate any video stream in the page."


def normalize_and_validate(url: str):
    url = (url or "").strip()
    if not url:
        return None, "Please paste a Facebook video or reel URL."
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    if not is_facebook_url(url):
        return None, "URL must be from facebook.com, fb.watch or fb.com."
    return url, None


def extract_one(url: str):
    cleaned, err = normalize_and_validate(url)
    if err:
        return {"ok": False, "input": url, "error": err}
    data, ferr = fetch_video(cleaned)
    if not data:
        return {"ok": False, "input": url, "error": ferr}
    return {"ok": True, "input": url, "data": data}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/v2")
def v2():
    return render_template("v2.html")


@app.route("/api/extract", methods=["POST"])
def api_extract():
    payload = request.get_json(silent=True) or {}
    result = extract_one(payload.get("url") or "")
    if not result["ok"]:
        status = 400 if result["error"].startswith(("Please", "URL must")) else 502
        return jsonify({"ok": False, "error": result["error"]}), status
    return jsonify({"ok": True, "data": result["data"]})


def _is_fbcdn(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return host.endswith(".fbcdn.net") or host == "fbcdn.net"


def _safe_filename(name: str, default: str = "facebook-video.mp4") -> str:
    if not name:
        return default
    name = re.sub(r"[\\/:*?\"<>|\r\n\t]+", "", name).strip()
    if not name.lower().endswith(".mp4"):
        name += ".mp4"
    return (name[:120]) or default


def _content_disposition(name: str) -> str:
    safe = _safe_filename(name)
    ascii_fallback = (
        safe.encode("ascii", "replace").decode("ascii").replace("?", "_")
        or "facebook-video.mp4"
    )
    encoded = quote(safe, safe="")
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


@app.route("/download")
def download():
    url = request.args.get("url", "").strip()
    raw_name = request.args.get("filename", "")

    if not url or not url.startswith(("http://", "https://")) or not _is_fbcdn(url):
        abort(400, "Only fbcdn.net URLs are allowed.")

    try:
        upstream = requests.get(url, stream=True, headers=DESKTOP_HEADERS, timeout=30)
    except requests.RequestException:
        abort(502, "Could not reach Facebook's CDN.")
    if not upstream.ok:
        upstream.close()
        abort(upstream.status_code, "Upstream fetch failed.")

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    headers = {
        "Content-Disposition": _content_disposition(raw_name),
        "Content-Type": upstream.headers.get("Content-Type", "video/mp4"),
    }
    length = upstream.headers.get("Content-Length")
    if length:
        headers["Content-Length"] = length

    return Response(stream_with_context(generate()), headers=headers)


@app.route("/api/extract-batch", methods=["POST"])
def api_extract_batch():
    payload = request.get_json(silent=True) or {}
    urls = payload.get("urls") or []
    if not isinstance(urls, list) or not urls:
        return jsonify({"ok": False, "error": "Provide a non-empty `urls` array."}), 400
    urls = [u for u in (str(x).strip() for x in urls) if u][:20]
    if not urls:
        return jsonify({"ok": False, "error": "No usable URLs after trimming."}), 400

    with ThreadPoolExecutor(max_workers=min(5, len(urls))) as pool:
        results = list(pool.map(extract_one, urls))

    return jsonify({"ok": True, "results": results})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
