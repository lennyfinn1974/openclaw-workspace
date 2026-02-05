// WebSocket Hook for Real-time Market Data
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTradingStore } from '@/stores/tradingStore';
import type { Quote, Order, Trade, Position, Portfolio, OHLCV, Timeframe } from '@/types/trading';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8101';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const {
    setConnected,
    updateQuote,
    setPortfolio,
    updatePosition,
    setPositions,
    addOrder,
    updateOrder,
    addTrade,
    addCandle,
    watchlist,
    selectedSymbol,
  } = useTradingStore();

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);

      // Subscribe to watchlist symbols
      socket.emit('subscribe', watchlist);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('quote', (quote: Quote) => {
      updateQuote(quote);
    });

    socket.on('portfolio', (portfolio: Portfolio) => {
      setPortfolio(portfolio);
    });

    socket.on('positions', (positions: Position[]) => {
      setPositions(positions);
    });

    socket.on('position', (position: Position) => {
      updatePosition(position);
    });

    socket.on('order', (order: Order) => {
      updateOrder(order);
    });

    socket.on('trade', (trade: Trade) => {
      addTrade(trade);
    });

    socket.on('candle', ({ symbol, timeframe, candle }: { symbol: string; timeframe: Timeframe; candle: OHLCV }) => {
      addCandle(symbol, timeframe, candle);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update subscriptions when watchlist changes
  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', watchlist);
    }
  }, [watchlist]);

  // Place order via WebSocket
  const placeOrder = useCallback(
    (orderParams: {
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop' | 'stop_limit';
      quantity: number;
      price?: number;
      stopPrice?: number;
      timeInForce?: string;
    }): Promise<{ success: boolean; order?: Order; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }

        socketRef.current.emit('placeOrder', orderParams, (response: { success: boolean; order?: Order; error?: string }) => {
          resolve(response);
        });
      });
    },
    []
  );

  // Cancel order via WebSocket
  const cancelOrder = useCallback(
    (orderId: string): Promise<{ success: boolean; order?: Order; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }

        socketRef.current.emit('cancelOrder', orderId, (response: { success: boolean; order?: Order; error?: string }) => {
          resolve(response);
        });
      });
    },
    []
  );

  // Subscribe to specific symbols
  const subscribe = useCallback((symbols: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', symbols);
    }
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', symbols);
    }
  }, []);

  return {
    placeOrder,
    cancelOrder,
    subscribe,
    unsubscribe,
    isConnected: socketRef.current?.connected || false,
  };
}
