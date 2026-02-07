// Market Timing — session-aware trading windows for 21-bot arena
// FX: 24/5 (Sunday 17:00 EST - Friday 17:00 EST)
// US Stocks: Pre-market 4:00, Regular 9:30-16:00, After-hours to 20:00 EST
// Commodity Futures: Nearly 24h Sunday-Friday (similar to FX)
// Crypto: 24/7

import type { BotGroupName } from './types';

export type MarketState = 'open' | 'pre_market' | 'after_hours' | 'closed';

interface SessionInfo {
  state: MarketState;
  canTrade: boolean;
  sessionName: string;
  nextOpen?: string;         // human-readable next open time
  volatilityMultiplier: number; // 0.0-1.5 based on session
}

function getEST(): { hour: number; minute: number; dayOfWeek: number } {
  const now = new Date();
  // EST = UTC-5 (ignoring DST for simplicity — EDT would be UTC-4)
  const estOffset = -5;
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay();
  let estHour = (utcHour + estOffset + 24) % 24;
  let estDay = utcDay;
  if (utcHour + estOffset < 0) estDay = (utcDay - 1 + 7) % 7;
  return { hour: estHour, minute: now.getUTCMinutes(), dayOfWeek: estDay };
}

function timeToMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

// FX markets: Open Sunday 17:00 EST → Friday 17:00 EST
export function getFxSession(): SessionInfo {
  const { hour, minute, dayOfWeek } = getEST();
  const time = timeToMinutes(hour, minute);
  const utcHour = new Date().getUTCHours();

  // Weekend: Saturday all day, Sunday before 17:00 EST
  if (dayOfWeek === 6) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Sunday 17:00 EST', volatilityMultiplier: 0 };
  }
  if (dayOfWeek === 0 && time < timeToMinutes(17, 0)) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Sunday 17:00 EST', volatilityMultiplier: 0 };
  }
  // Friday after 17:00 EST
  if (dayOfWeek === 5 && time >= timeToMinutes(17, 0)) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Sunday 17:00 EST', volatilityMultiplier: 0 };
  }

  // Session-based volatility (UTC hours for global sessions)
  let volatilityMultiplier = 0.6;
  let sessionName = 'Off-hours';

  if (utcHour >= 0 && utcHour < 7) {
    sessionName = 'Asian/Sydney';
    volatilityMultiplier = 0.8;
  } else if (utcHour >= 7 && utcHour < 12) {
    sessionName = 'London';
    volatilityMultiplier = 1.2;
  } else if (utcHour >= 12 && utcHour < 16) {
    sessionName = 'London-NY Overlap';
    volatilityMultiplier = 1.5;
  } else if (utcHour >= 16 && utcHour < 21) {
    sessionName = 'New York';
    volatilityMultiplier = 1.1;
  }

  return { state: 'open', canTrade: true, sessionName, volatilityMultiplier };
}

// US Stock market: Pre 4:00, Regular 9:30-16:00, After 16:00-20:00 EST
export function getUSStockSession(): SessionInfo {
  const { hour, minute, dayOfWeek } = getEST();
  const time = timeToMinutes(hour, minute);

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Monday 4:00 AM EST', volatilityMultiplier: 0 };
  }

  // Pre-market: 4:00 AM - 9:30 AM EST
  if (time >= timeToMinutes(4, 0) && time < timeToMinutes(9, 30)) {
    return { state: 'pre_market', canTrade: true, sessionName: 'Pre-Market', volatilityMultiplier: 0.5 };
  }

  // Regular hours: 9:30 AM - 4:00 PM EST
  if (time >= timeToMinutes(9, 30) && time < timeToMinutes(16, 0)) {
    // Opening 30 min and closing 30 min = higher volatility
    if (time < timeToMinutes(10, 0) || time >= timeToMinutes(15, 30)) {
      return { state: 'open', canTrade: true, sessionName: 'Regular (Power Hour)', volatilityMultiplier: 1.3 };
    }
    return { state: 'open', canTrade: true, sessionName: 'Regular', volatilityMultiplier: 1.0 };
  }

  // After-hours: 4:00 PM - 8:00 PM EST
  if (time >= timeToMinutes(16, 0) && time < timeToMinutes(20, 0)) {
    return { state: 'after_hours', canTrade: true, sessionName: 'After-Hours', volatilityMultiplier: 0.4 };
  }

  return { state: 'closed', canTrade: false, sessionName: 'Closed', nextOpen: 'Tomorrow 4:00 AM EST', volatilityMultiplier: 0 };
}

// Commodity futures: Nearly 24h Sun-Fri (CME Globex: Sunday 17:00 - Friday 16:00 EST, daily halt 16:00-17:00)
export function getCommoditySession(): SessionInfo {
  const { hour, minute, dayOfWeek } = getEST();
  const time = timeToMinutes(hour, minute);

  // Weekend
  if (dayOfWeek === 6) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Sunday 17:00 EST', volatilityMultiplier: 0 };
  }
  if (dayOfWeek === 0 && time < timeToMinutes(17, 0)) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Sunday 17:00 EST', volatilityMultiplier: 0 };
  }
  // Friday after 16:00 EST
  if (dayOfWeek === 5 && time >= timeToMinutes(16, 0)) {
    return { state: 'closed', canTrade: false, sessionName: 'Weekend', nextOpen: 'Sunday 17:00 EST', volatilityMultiplier: 0 };
  }

  // Daily maintenance halt: 16:00-17:00 EST
  if (time >= timeToMinutes(16, 0) && time < timeToMinutes(17, 0)) {
    return { state: 'closed', canTrade: false, sessionName: 'Daily Halt', nextOpen: '17:00 EST', volatilityMultiplier: 0 };
  }

  // Active trading — US session gets higher volatility
  if (time >= timeToMinutes(9, 0) && time < timeToMinutes(14, 30)) {
    return { state: 'open', canTrade: true, sessionName: 'US Session', volatilityMultiplier: 1.2 };
  }

  return { state: 'open', canTrade: true, sessionName: 'Globex', volatilityMultiplier: 0.8 };
}

// Crypto: 24/7
export function getCryptoSession(): SessionInfo {
  return { state: 'open', canTrade: true, sessionName: '24/7', volatilityMultiplier: 1.0 };
}

// Get session for a specific symbol based on its group
export function getSymbolSession(symbol: string, groupName: BotGroupName): SessionInfo {
  // BTC in Gamma is crypto
  if (symbol === 'BTC') return getCryptoSession();

  switch (groupName) {
    case 'Alpha':
      return getFxSession();
    case 'Beta':
      return getUSStockSession();
    case 'Gamma':
      // LTHM is a stock
      if (symbol === 'LTHM') return getUSStockSession();
      // Gold/Silver spot trade like FX (nearly 24h)
      if (symbol === 'GC=F' || symbol === 'SI=F') return getFxSession();
      // Other commodities use futures schedule
      return getCommoditySession();
    default:
      return { state: 'open', canTrade: true, sessionName: 'Unknown', volatilityMultiplier: 1.0 };
  }
}

// Get all sessions summary for status display
export function getAllSessionsStatus(): Record<BotGroupName, SessionInfo> {
  return {
    Alpha: getFxSession(),
    Beta: getUSStockSession(),
    Gamma: getCommoditySession(),
  };
}

// Get current time in Gulf Standard Time (UTC+4) for display
export function getGSTTime(): { hour: number; minute: number; dayOfWeek: number; formatted: string } {
  const now = new Date();
  const gstOffset = 4;
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay();
  let gstHour = (utcHour + gstOffset) % 24;
  let gstDay = utcDay;
  if (utcHour + gstOffset >= 24) gstDay = (utcDay + 1) % 7;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const minute = now.getUTCMinutes();
  const formatted = `${dayNames[gstDay]} ${String(gstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} GST`;
  return { hour: gstHour, minute, dayOfWeek: gstDay, formatted };
}
