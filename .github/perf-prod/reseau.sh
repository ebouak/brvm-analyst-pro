#!/usr/bin/env bash
# En-têtes et temps réseau de chaque page (5 essais), depuis le runner.
set -u
BASE="$1"; shift
for p in "$@"; do
  for i in 1 2 3 4 5; do
    curl -s -o /dev/null -H 'Accept-Encoding: br, gzip' -A 'Mozilla/5.0 (Linux; Android 13; Pixel 7) perf-audit' \
      -w "{\"page\":\"$p\",\"essai\":$i,\"statut\":%{http_code},\"dnsMs\":%{time_namelookup},\"connexionMs\":%{time_connect},\"tlsMs\":%{time_appconnect},\"ttfbS\":%{time_starttransfer},\"totalS\":%{time_total},\"octets\":%{size_download}}\n" "$BASE$p"
  done
  curl -s -D - -o /dev/null -H 'Accept-Encoding: br, gzip' "$BASE$p" | tr -d '\r' | grep -iE '^(http/|content-encoding|cache-control|x-vercel-cache|x-vercel-id|age|server-timing|content-type)' | sed "s#^#ENTETE $p | #"
done
