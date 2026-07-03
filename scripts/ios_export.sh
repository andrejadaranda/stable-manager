#!/bin/bash
# Export the unsigned archive as a signed App Store .ipa. -allowProvisioningUpdates
# creates the Apple Distribution cert + App Store provisioning profile on demand
# (no device needed for distribution). Logs to /tmp/ios_export.log.
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/ios_export.done
rm -rf /tmp/LongreinExport
echo "=== xcodebuild -exportArchive (App Store, signed) ==="
xcodebuild -exportArchive \
  -archivePath /tmp/Longrein.xcarchive \
  -exportPath /tmp/LongreinExport \
  -exportOptionsPlist ios/exportOptions.plist \
  -allowProvisioningUpdates 2>&1 | tail -50
CODE=${PIPESTATUS[0]}
echo "$CODE" > /tmp/ios_export.done
echo "EXPORT_EXIT=$CODE"
ls -la /tmp/LongreinExport/ 2>/dev/null
