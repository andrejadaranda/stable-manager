#!/bin/bash
# Install JS deps + sync the native iOS project so newly-added Capacitor
# plugins (e.g. @capacitor-community/background-geolocation) get their
# CocoaPods wired into App.xcworkspace. Logs to /tmp/capsync.log.
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/capsync.done
echo "=== npm install ==="
npm install 2>&1
NPM=$?
echo "NPM_EXIT=$NPM"
if [ $NPM -ne 0 ]; then echo "npm:$NPM" > /tmp/capsync.done; exit $NPM; fi
echo "=== npx cap sync ios ==="
npx cap sync ios 2>&1
SYNC=$?
echo "SYNC_EXIT=$SYNC"
echo "sync:$SYNC" > /tmp/capsync.done
