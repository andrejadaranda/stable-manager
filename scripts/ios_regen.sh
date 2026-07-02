#!/bin/bash
# Clean regen of the iOS Xcode project. Our repo shipped an ios/ folder with
# reference docs + the icon set, which made `cap add ios` refuse. Preserve
# those, wipe ios/, regenerate cleanly (this runs pod install), then restore
# the docs. Logs to /tmp/ios_regen.log, writes /tmp/ios_regen.done at end.
set -o pipefail
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/ios_regen.done

KEEP=/tmp/longrein_ios_keep
echo "=== preserving reference assets -> $KEEP ==="
rm -rf "$KEEP"; mkdir -p "$KEEP"
cp -R ios/AppIcon.appiconset "$KEEP/" 2>/dev/null
cp ios/*.md "$KEEP/" 2>/dev/null
cp ios/app-icon-1024.svg "$KEEP/" 2>/dev/null

echo "=== wiping ios/ ==="
rm -rf ios

echo "=== npx cap add ios (generates Xcode project + pod install) ==="
npx cap add ios 2>&1
ADD=$?
echo "cap add exit=$ADD"

echo "=== npx cap sync ios ==="
npx cap sync ios 2>&1

echo "=== restore reference docs into ios/ ==="
cp "$KEEP"/*.md ios/ 2>/dev/null
cp "$KEEP"/app-icon-1024.svg ios/ 2>/dev/null
cp -R "$KEEP/AppIcon.appiconset" ios/ 2>/dev/null

echo "=== result tree ==="
ls -la ios 2>/dev/null
echo "--- ios/App ---"
ls -la ios/App 2>/dev/null
echo "--- Podfile? ---"
test -f ios/App/Podfile && echo PODFILE_OK || echo PODFILE_MISSING
echo "done" > /tmp/ios_regen.done
echo "EXIT_DONE"
