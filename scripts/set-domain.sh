#!/usr/bin/env bash
# Point the whole site at a new domain.
#
#   ./scripts/set-domain.sh subasghimire.com.np
#   ./scripts/set-domain.sh subasghimire.com.np subas-ghimire.vercel.app   # explicit old domain
#
# Rewrites every absolute URL in the site (canonical, og/twitter, JSON-LD,
# sitemap, robots, README) and prints the DNS checklist. It does not touch
# Vercel or the registrar - those steps need account access.
set -euo pipefail

NEW="${1:?usage: set-domain.sh <new-domain> [old-domain]}"
OLD="${2:-subas-ghimire.vercel.app}"

NEW="${NEW#https://}"; NEW="${NEW#http://}"; NEW="${NEW%/}"
OLD="${OLD#https://}"; OLD="${OLD#http://}"; OLD="${OLD%/}"

if [ "$NEW" = "$OLD" ]; then
  echo "new and old domain are the same ($NEW) - nothing to do" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

python3 - "$OLD" "$NEW" <<'PY'
import sys, pathlib

old, new = sys.argv[1], sys.argv[2]
files = ["index.html", "about.html", "work.html", "cv.html", "subas-ghimire.html", "404.html",
         "signup.html", "signup-thanks.html", "thanks.html", "members.html", "subas-ghimire.vcf",
         "robots.txt", "sitemap.xml", "README.md", "api/chat.js"]

total = 0
for name in files:
    p = pathlib.Path(name)
    if not p.exists():
        print(f"  skip  {name} (missing)")
        continue
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    if n:
        p.write_text(s.replace(old, new), encoding="utf-8")
    total += n
    print(f"  {name:20} {n:>3} url(s)")

print(f"\n{total} absolute URL(s) now point at https://{new}")
PY

cat <<EOF

Next steps (need account access, do them in this order):

1. Vercel -> project -> Settings -> Domains -> add  $NEW
   (and set it as the primary domain; keep the vercel.app one redirecting)

2. .np panel (register.com.np -> Domains -> Edit DNS) -> nameservers:
       ns1.vercel-dns.com
       ns2.vercel-dns.com
   FQDN only - the registry rejects IP addresses. Requests are processed
   twice a day and propagation can take 24-48h.

3. Once https://$NEW answers 200:

       curl -sS -o /dev/null -w '%{http_code}\n' https://$NEW
       curl -sS -o /dev/null -w '%{http_code}\n' https://www.$NEW

4. Optional: keep the GitHub Pages mirror on github.io (no CNAME file) so it
   does not compete with the custom domain for search results.
EOF
