#!/bin/bash
# Generate a fresh passwordless magic link and open it in the booted simulator's
# Safari. Never prints the token.
set -e
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
get() { grep -E "^$1=" .env.local | head -1 | sed -E "s/^$1=//; s/^\"//; s/\"$//; s/^'//; s/'$//"; }
URL=$(get NEXT_PUBLIC_SUPABASE_URL)
SR=$(get SUPABASE_SERVICE_ROLE_KEY)
RESP=$(curl -s -X POST "$URL/auth/v1/admin/generate_link" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
  -d '{"type":"magiclink","email":"demo.owner@longrein.eu","options":{"redirect_to":"https://app.longrein.eu/dashboard"}}')
LINK=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("action_link") or d.get("properties",{}).get("action_link") or "")' 2>/dev/null)
if [ -z "$LINK" ]; then echo "NO_LINK resp=$(echo "$RESP" | head -c 200)"; exit 2; fi
xcrun simctl openurl booted "$LINK"
echo "OPENED_MAGIC_LINK_IN_SIM"
