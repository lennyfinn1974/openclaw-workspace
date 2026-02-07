// Arena WebSocket Hook - Subscribes to arena:* events and updates arenaStore
'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useArenaStore } from '@/stores/arenaStore';
import type {
  ArenaBotTradeEvent,
  ArenaLeaderboardEvent,
  ArenaEvolutionEvent,
  ArenaTournamentEvent,
  ArenaStatus,
} from '@/types/arena';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8101';

export function useArenaWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const {
    addActivityEvent,
    setLeaderboard,
    setTournament,
    setStatus,
    updateTournamentRound,
    setBots,
  } = useArenaStore();

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Subscribe to arena events
      socket.emit('arena:subscribe');
    });

    // Arena status
    socket.on('arena:status', (status: ArenaStatus) => {
      setStatus(status);
    });

    // Bot trades (activity feed)
    socket.on('arena:bot:trade', (event: ArenaBotTradeEvent) => {
      addActivityEvent(event);
    });

    // Leaderboard updates
    socket.on('arena:leaderboard', (event: ArenaLeaderboardEvent) => {
      setLeaderboard(event.entries);
    });

    // Tournament lifecycle events
    socket.on('arena:tournament', (event: ArenaTournamentEvent) => {
      if (event.type === 'round_start' || event.type === 'round_end') {
        if (event.round !== undefined) {
          updateTournamentRound(event.round);
        }
      }
      if (event.type === 'complete') {
        const store = useArenaStore.getState();
        if (store.tournament) {
          setTournament({ ...store.tournament, status: 'completed' });
        }
      }
    });

    // Evolution events
    socket.on('arena:evolution', (event: ArenaEvolutionEvent) => {
      if (event.type === 'complete' && event.results) {
        useArenaStore.getState().setEvolutionHistory(event.results);
        // Refresh bots after evolution
        fetch(`${WS_URL}/api/arena/bots`)
          .then(r => r.json())
          .then(bots => setBots(bots))
          .catch(() => {});
      }
    });

    return () => {
      socket.emit('arena:unsubscribe');
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
