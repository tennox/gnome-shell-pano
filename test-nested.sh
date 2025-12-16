#!/usr/bin/env bash

# Script to test Pano extension in a nested GNOME session safely

set -e

echo "🔨 Building extension..."
yarn build

echo "🔗 Linking extension to test directory..."
mkdir -p /tmp/gnome-shell-test-extensions
ln -sf "$PWD/dist" "/tmp/gnome-shell-test-extensions/pano-gom@txlab.io"

echo "🚀 Starting nested GNOME Shell session..."
echo "   - Extensions directory: /tmp/gnome-shell-test-extensions"
echo "   - Press Alt+F2 and type 'r' to restart shell if needed"
echo "   - Use Ctrl+Alt+Shift+R to enable looking glass for debugging"
echo "   - Close the nested window to exit"

export GNOME_SHELL_EXTENSION_DIR=/tmp/gnome-shell-test-extensions
export MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800
export MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1

# Start nested GNOME Shell
dbus-run-session -- gnome-shell --nested --wayland

echo "✅ Nested session closed"