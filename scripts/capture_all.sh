#!/bin/bash
# Recapture all App Store screens at the adjusted Safari zoom (~85%, more compact).
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH
rm -f /tmp/capture_all.done
shot () { # url name
  xcrun simctl openurl booted "$1"
  sleep 8
  xcrun simctl io booted screenshot "/tmp/shot_$2.png"
  echo "captured $2"
}
shot "https://app.longrein.eu/dashboard" 01dash
shot "https://app.longrein.eu/dashboard/calendar" 02cal
shot "https://app.longrein.eu/dashboard/finance" 03fin
shot "https://app.longrein.eu/dashboard/horses/a0000001-0000-4000-0000-000000000001" 04horse
shot "https://app.longrein.eu/dashboard/sessions" 05rides
shot "https://app.longrein.eu/dashboard/welfare" 06welfare
echo done > /tmp/capture_all.done
