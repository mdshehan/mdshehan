"""Diagnostic: show how Facebook responds to each URL variant, and dump HTML
for any 200 response so we can see what patterns to extract.

Usage:
    python diagnose.py "https://www.facebook.com/reel/1729230194760012"

Output files (current dir):
    diag_<host>_<ua>.html  — saved page for any 2xx response
"""
import re
import sys
from urllib.parse import urlparse

from app import (
    _candidate_urls,
    _warm_session,
    DESKTOP_HEADERS,
    MOBILE_HEADERS,
    extract_from_html,
)


def signals(html: str):
    return {
        "bytes": len(html),
        "fbcdn_mentions": len(re.findall(r"fbcdn\.net", html)),
        "mp4_mentions": len(re.findall(r"\.mp4", html)),
        "dash_manifest": "dash_manifest" in html,
        "playable_url": "playable_url" in html,
        "hd_src": "hd_src" in html,
        "browser_native": "browser_native" in html,
        "login_wall": any(
            s in html.lower()
            for s in ("loginform", "log into facebook", "you must log in", "/login/?next=")
        ),
    }


def safe_host(u: str) -> str:
    return (urlparse(u).hostname or "x").replace(".", "_")


def main():
    if len(sys.argv) < 2:
        print('Usage: python diagnose.py "<facebook url>"')
        sys.exit(1)

    url = sys.argv[1]
    session = _warm_session()
    print(f"Warm-up cookies: {dict(session.cookies)}\n")

    for candidate in _candidate_urls(url):
        for label, headers in (("desktop", DESKTOP_HEADERS), ("mobile", MOBILE_HEADERS)):
            try:
                r = session.get(candidate, headers=headers, timeout=20, allow_redirects=True)
            except Exception as e:
                print(f"[ERR] {label:7} {candidate}\n        {e}\n")
                continue

            data = extract_from_html(r.text)
            print(f"[{r.status_code}] {label:7} {candidate}")
            print(f"        final_url={r.url}")

            if 200 <= r.status_code < 300:
                sig = signals(r.text)
                print(
                    f"        bytes={sig['bytes']}  "
                    f"fbcdn={sig['fbcdn_mentions']}  mp4={sig['mp4_mentions']}  "
                    f"dash={sig['dash_manifest']}  playable={sig['playable_url']}  "
                    f"hd_src={sig['hd_src']}  bn={sig['browser_native']}  "
                    f"login_wall={sig['login_wall']}"
                )
                fname = f"diag_{safe_host(candidate)}_{label}.html"
                with open(fname, "w", encoding="utf-8") as f:
                    f.write(r.text)
                print(f"        saved -> {fname}")

                if data["hd_url"] or data["sd_url"]:
                    print("        >>> SUCCESS <<<")
                    print(f"        hd={data['hd_url']}")
                    print(f"        sd={data['sd_url']}")
                    return
            print()


if __name__ == "__main__":
    main()

