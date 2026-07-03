#!/bin/bash
# Launch the App Store upload in the background and return immediately.
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/ios_upload.done
nohup bash scripts/ios_upload.sh > /tmp/ios_upload.log 2>&1 &
echo "UPLOAD_LAUNCHED pid=$!"
