# Log System - 15 Day Auto-Cleanup

## Purpose
Store larger datasets, command outputs, and diagnostic data to prevent context window bloat.

## Structure
- `logs/YYYY-MM-DD/` - Daily log directories
- `logs/cleanup.sh` - Auto-cleanup script (removes logs >15 days)
- `logs/terminal-sessions/` - Terminal session dumps
- `logs/diagnostics/` - System diagnostic outputs
- `logs/memory-dumps/` - Large memory search results

## Usage
Instead of dumping large outputs to context:
1. Write to appropriate log file
2. Provide summary with log reference
3. User can check logs if detailed view needed

## Cleanup
Automatic cleanup via cron: `0 2 * * * ~/logs/cleanup.sh` (daily at 2 AM)