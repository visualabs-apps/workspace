#!/bin/bash
# Kill all Electron processes (Linux/Mac)

echo "🔍 Searching for Electron processes..."

if pgrep -x "electron" > /dev/null; then
    echo "⚠️  Found Electron processes"
    pkill -9 electron
    echo "✅ All Electron processes killed"
else
    echo "✅ No Electron processes found"
fi

echo ""
echo "Now you can run: npm run dev"
