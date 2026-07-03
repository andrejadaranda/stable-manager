#!/bin/bash
# Generate a passwordless magic link for the demo account via the project's own
# Supabase auth admin API. Reads keys from .env.local; prints ONLY the link.
set -e
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
get() { grep -E "^$1=" .env.local | head -1 | sed -E "s/^$1=//; s/^\"//; s/\"$//; s/^'//; s/'$//"; }
URL=$(get NEXT_PUBLIC_SUPABASE_URL)
SR=$(get SUPABASE_SERVICE_ROLE_KEY)
if [ -z "$URL" ] || [ -z "$SR" ]; then echo "MISSING_ENV url=[$URL]"; exit 2; fi
echo "url_host=$(echo "$URL" | sed 's#https://##')"
RESP=$(curl -s -X POST "$URL/auth/v1/admin/generate_link" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
  -d '{"type":"magiclink","email":"demo.owner@longrein.eu","options":{"redirect_to":"https://app.longrein.eu/dashboard"}}')
# extract action_link without printing the token secrets of the raw body
LINK=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("action_link") or d.get("properties",{}).get("action_link") or ("ERR:"+json.dumps(d)[:300]))' 2>/dev/null)
echo "LINK=$LINK"
