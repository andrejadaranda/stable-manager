#!/bin/bash
# Launch the iOS archive in the background and return immediately.
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/ios_archive.done
nohup bash scripts/ios_archive.sh > /tmp/ios_archive.log 2>&1 &
echo "ARCHIVE_LAUNCHED pid=$!"
