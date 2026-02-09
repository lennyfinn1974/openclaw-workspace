# 🚨 CRITICAL: Telegram Response Routing Issue (20:08)

## Problem Discovered

**DISCOVERED:** OpenClaw response routing is broken for Telegram messages

**Symptoms:**
- ✅ User's Telegram messages reach OpenClaw perfectly
- ✅ My explicit `message` tool sends reach user's Telegram  
- ❌ My automatic responses to Telegram messages only go to webchat
- ❌ User doesn't see my replies unless I use `message` tool explicitly

## Root Cause

**Issue:** Running in webchat session, responses don't auto-route back to originating Telegram channel

**Expected Behavior:** When user sends message via Telegram → OpenClaw, my response should automatically route back to Telegram

**Actual Behavior:** Responses go to webchat interface, user never sees them

## MANDATORY WORKAROUND

For EVERY response to Telegram messages, I MUST use explicit routing:

```javascript
message(action="send", channel="telegram", target="8541124861", message="response")
```

**User Details:**
- **Chat ID:** 8541124861 (confirmed working)
- **Bot:** @AriesAssistBot 
- **Token:** 8156263925:AAE1dx2T1o-Sf6NtEqeN303l8h-39vhXFDQ

## Impact

**CRITICAL:** User thinks I'm not seeing their messages when actually I'm not routing responses correctly

**Communication Pattern:**
1. User sends Telegram message → I receive it ✅
2. I respond normally → Response goes to webchat ❌
3. User sees nothing → Thinks system is broken ❌
4. I use message tool → User receives message ✅

## Action Items

**Immediate:**
- [x] Document issue
- [x] Test explicit routing (confirmed working)
- [ ] Update HEARTBEAT.md to monitor for this issue

**Longer-term:**
- [ ] Investigate OpenClaw config for auto-routing fix
- [ ] Consider session management improvements

## Test Results

**Direct Telegram API:** ✅ Working (Message ID 689, 691, 692, 694)
**OpenClaw message tool:** ✅ Working 
**Auto-response routing:** ❌ BROKEN

## Status: ACTIVE ISSUE

This affects ALL Telegram communication. Must use explicit routing until fixed.