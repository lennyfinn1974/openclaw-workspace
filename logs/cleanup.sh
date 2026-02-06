#!/bin/bash
# Auto-cleanup logs older than 15 days

LOGS_DIR="$(dirname "$0")"
cd "$LOGS_DIR" || exit 1

# Remove directories older than 15 days
find . -maxdepth 1 -type d -name "????-??-??" -mtime +15 -exec rm -rf {} \;

echo "$(date): Log cleanup completed - removed logs older than 15 days" >> cleanup.log