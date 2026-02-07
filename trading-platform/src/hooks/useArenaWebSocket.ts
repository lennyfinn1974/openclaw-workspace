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
} from '@/types/arena';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8101';

export function useArenaWebSocket() {
  const socketRef = useRef<Socket | null>(null);

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
      socket.emit('arena:subscribe');
    });

    // Use getState() to avoid subscribing the component to the store
    socket.on('arena:bot:trade', (event: ArenaBotTradeEvent) => {
      useArenaStore.getState().addActivityEvent(event);
    });

    socket.on('arena:leaderboard', (event: ArenaLeaderboardEvent) => {
      useArenaStore.getState().setLeaderboard(event.entries);
    });

    socket.on('arena:tournament', (event: ArenaTournamentEvent) => {
      const store = useArenaStore.getState();
      if (event.type === 'round_start' || event.type === 'round_end') {
        if (event.round !== undefined) {
          store.updateTournamentRound(event.round);
        }
      }
      if (event.type === 'complete') {
        if (store.tournament) {
          store.setTournament({ ...store.tournament, status: 'completed' });
        }
      }
    });

    socket.on('arena:evolution', (event: ArenaEvolutionEvent) => {
      if (event.type === 'complete' && event.results) {
        useArenaStore.getState().setEvolutionHistory(event.results);
        fetch(`${WS_URL}/api/arena/bots`)
          .then(r => r.json())
          .then(bots => useArenaStore.getState().setBots(bots))
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
