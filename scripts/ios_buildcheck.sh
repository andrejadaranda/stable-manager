#!/bin/bash
# Compile-only sanity build (simulator, no code signing) to prove the generated
# project is coherent before Xcode signing/archive. Needs no Apple credentials.
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase/ios/App || exit 99
rm -f /tmp/ios_buildcheck.done
echo "=== xcodebuild simulator compile (no signing) ==="
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tail -40
CODE=${PIPESTATUS[0]}
echo "$CODE" > /tmp/ios_buildcheck.done
echo "XCODEBUILD_EXIT=$CODE"
