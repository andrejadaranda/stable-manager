#!/bin/bash
# Launch npm install + cap sync in the background and return immediately.
cd /Users/andrejadaranda/Documents/App-projektas/Codebase || exit 99
rm -f /tmp/capsync.done
nohup bash scripts/capsync.sh > /tmp/capsync.log 2>&1 &
echo "CAPSYNC_LAUNCHED pid=$!"
