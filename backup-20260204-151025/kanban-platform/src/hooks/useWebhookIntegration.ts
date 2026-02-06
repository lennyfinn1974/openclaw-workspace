/**
 * Webhook Integration Hook
 * 
 * React hook for managing webhook integration and real-time updates.
 */

import { useEffect, useState, useCallback } from 'react';
import { useKanbanStore } from '@/stores/kanban';
import { webhookService, WebhookUpdateEvent, CombinedData } from '@/services/webhookIntegration';

interface UseWebhookIntegrationOptions {
  autoConnect?: boolean;
  enableLiveUpdates?: boolean;
}

interface WebhookIntegrationState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  updateCount: number;
}

export function useWebhookIntegration(options: UseWebhookIntegrationOptions = {}) {
  const { autoConnect = true, enableLiveUpdates = true } = options;
  
  const [state, setState] = useState<WebhookIntegrationState>({
    isConnected: false,
    isLoading: false,
    error: null,
    lastUpdate: null,
    updateCount: 0
  });

  const {
    setLoading,
    setError,
    setLiveData,
  } = useKanbanStore();

  // Connect to webhook service
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await webhookService.connect();
      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isLoading: false 
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        isLoading: false, 
        error: message 
      }));
      setError(message);
    }
  }, [setError]);

  // Disconnect from webhook service
  const disconnect = useCallback(() => {
    webhookService.disconnect();
    setState(prev => ({ 
      ...prev, 
      isConnected: false 
    }));
  }, []);

  // Load combined data (migration + live)
  const loadCombinedData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const data = await webhookService.fetchCombinedData();
      
      // Update the kanban store with the combined data
      console.log('📊 Loaded combined data:', {
        boards: data.boards.length,
        columns: data.columns.length,
        tasks: data.tasks.length,
        agents: data.agents.length,
        activities: data.activities.length
      });
      
      // Set the live data in the kanban store
      setLiveData({
        boards: data.boards,
        columns: data.columns,
        tasks: data.tasks
      });
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        lastUpdate: new Date()
      }));
      
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load data';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: message 
      }));
      setError(message);
      throw error;
    }
  }, [setError, setLiveData]);

  // Send test webhook
  const sendTestWebhook = useCallback(async (data: { 
    objective?: string; 
    priority?: string; 
    label?: string 
  }) => {
    try {
      const result = await webhookService.sendTestWebhook(data);
      console.log('🧪 Test webhook sent:', result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test webhook';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  // Check server health
  const checkHealth = useCallback(async () => {
    try {
      return await webhookService.checkServerHealth();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Health check failed';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  // Handle live data updates
  const handleLiveUpdate = useCallback((event: WebhookUpdateEvent) => {
    console.log('🔴 Live update received:', event);
    
    setState(prev => ({ 
      ...prev, 
      lastUpdate: new Date(),
      updateCount: prev.updateCount + 1
    }));

    if (event.type === 'webhook-processed' || event.type === 'test-webhook') {
      console.log('🎯 New ticket created from webhook:', event.result);
      
      // Show notification or toast
      if (event.webhook && event.result) {
        const message = `New task created: ${event.webhook.metadata?.label || 'Unknown'} (Agent: ${event.webhook.agentId})`;
        console.log('📋 ' + message);
        // You can add toast notification here
      }
    }

    // If we have full data sync, update the store with deduplication
    if (event.data && enableLiveUpdates) {
      console.log('📊 Syncing live data to store with deduplication...');
      setLiveData({
        boards: event.data.boards || [],
        columns: event.data.columns || [],
        tasks: event.data.tasks || []
      });
    }
  }, [enableLiveUpdates]);

  // Setup event listeners
  useEffect(() => {
    if (enableLiveUpdates) {
      webhookService.on('live-data-update', handleLiveUpdate);
      
      webhookService.on('connected', () => {
        setState(prev => ({ ...prev, isConnected: true }));
      });
      
      webhookService.on('disconnected', () => {
        setState(prev => ({ ...prev, isConnected: false }));
      });
    }

    return () => {
      webhookService.off('live-data-update', handleLiveUpdate);
      webhookService.off('connected', () => {});
      webhookService.off('disconnected', () => {});
    };
  }, [enableLiveUpdates, handleLiveUpdate]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    loadCombinedData,
    sendTestWebhook,
    checkHealth,
    
    // Utilities
    isReady: state.isConnected && !state.isLoading,
    socketId: webhookService.getSocketId(),
  };
}