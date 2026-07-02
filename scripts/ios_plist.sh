#!/bin/bash
# Idempotently add the v1 permission strings + location background mode to the
# generated iOS Info.plist. Safe to re-run: each key is deleted (errors ignored)
# then re-added. See ios/INFO_PLIST_PERMISSIONS.md for the source of truth.
set -e
PB=/usr/libexec/PlistBuddy
PLIST="/Users/andrejadaranda/Documents/App-projektas/Codebase/ios/App/App/Info.plist"

add_str () {
  local key="$1"; local val="$2"
  $PB -c "Delete :$key" "$PLIST" >/dev/null 2>&1 || true
  $PB -c "Add :$key string $val" "$PLIST"
}

add_str NSLocationWhenInUseUsageDescription "Longrein records your route, distance, and pace while you ride so you can review the ride afterwards."
add_str NSLocationAlwaysAndWhenInUseUsageDescription "Allow Longrein to keep recording your ride in the background so distance and route continue when your phone screen sleeps."
add_str NSCameraUsageDescription "Take a photo of your horse to add to its profile."
add_str NSPhotoLibraryUsageDescription "Choose a photo of your horse, your stable, or your profile from your library."
add_str NSPhotoLibraryAddUsageDescription "Save a horse photo or ride card to your camera roll."

# UIBackgroundModes array with a single "location" entry
$PB -c "Delete :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || true
$PB -c "Add :UIBackgroundModes array" "$PLIST"
$PB -c "Add :UIBackgroundModes:0 string location" "$PLIST"

echo "=== resulting Info.plist ==="
$PB -c "Print" "$PLIST"
