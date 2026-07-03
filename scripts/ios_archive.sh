#!/bin/bash
# Archive Longrein UNSIGNED, then sign at export time with App Store distribution.
# Archive-time automatic signing wrongly picks a development profile (needs a
# device); decoupling signing to the export step lets -allowProvisioningUpdates
# create the distribution cert + App Store profile (no device needed).
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase/ios/App || exit 99
rm -f /tmp/ios_archive.done
echo "=== xcodebuild archive (UNSIGNED) ==="
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/Longrein.xcarchive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  archive 2>&1 | tail -40
CODE=${PIPESTATUS[0]}
echo "$CODE" > /tmp/ios_archive.done
echo "ARCHIVE_EXIT=$CODE"
test -d /tmp/Longrein.xcarchive && echo "XCARCHIVE_OK" || echo "XCARCHIVE_MISSING"
