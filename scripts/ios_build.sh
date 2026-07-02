#!/bin/bash
# One-shot iOS project generator for Longrein. Logs to /tmp/ios_build.log,
# writes /tmp/ios_build.done with the exit code when finished.
set -o pipefail
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/ios_build.done

echo "=== [1/4] npm install ==="
npm install 2>&1

echo "=== [2/4] npx cap add ios ==="
if [ -d ios/App ]; then
  echo "ios/App already exists — skipping add"
else
  npx cap add ios 2>&1
fi

echo "=== [3/4] npx cap sync ios ==="
npx cap sync ios 2>&1

echo "=== [4/4] done ==="
CODE=$?
echo "$CODE" > /tmp/ios_build.done
echo "EXIT $CODE"
