"""Diagnostic: show exactly how Facebook responds to each URL variant.

Usage:
    python diagnose.py "https://www.facebook.com/reel/1729230194760012"
"""
import sys

from app import _candidate_urls, _warm_session, DESKTOP_HEADERS, MOBILE_HEADERS, extract_from_html


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
                status = r.status_code
                size = len(r.text)
                data = extract_from_html(r.text)
                found = "HD" if data["hd_url"] else ("SD" if data["sd_url"] else "none")
                print(f"[{status}] {label:7} {candidate}")
                print(f"        final_url={r.url}")
                print(f"        html={size} bytes, video={found}, title={data['title']!r}")
                if data["hd_url"] or data["sd_url"]:
                    print("        >>> SUCCESS <<<")
                    print(f"        hd={data['hd_url']}")
                    print(f"        sd={data['sd_url']}")
                    return
            except Exception as e:
                print(f"[ERR] {label:7} {candidate}\n        {e}")
            print()


if __name__ == "__main__":
    main()
