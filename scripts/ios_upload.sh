#!/bin/bash
# Upload the archive to App Store Connect directly. exportOptions.plist has
# destination=upload; -allowProvisioningUpdates + the Apple ID logged into Xcode
# authenticate the upload (no separate API key). Logs to /tmp/ios_upload.log.
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/ios_upload.done
rm -rf /tmp/LongreinUpload
echo "=== xcodebuild -exportArchive (destination=upload) ==="
xcodebuild -exportArchive \
  -archivePath /tmp/Longrein.xcarchive \
  -exportPath /tmp/LongreinUpload \
  -exportOptionsPlist ios/exportOptions.plist \
  -allowProvisioningUpdates 2>&1 | tail -60
CODE=${PIPESTATUS[0]}
echo "$CODE" > /tmp/ios_upload.done
echo "UPLOAD_EXIT=$CODE"
