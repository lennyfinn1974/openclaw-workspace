/**
 * Webhook Integration Service
 * 
 * Handles real-time communication with the backend server
 * and processes OpenClaw webhook events for live ticket creation.
 */

import { io, Socket } from 'socket.io-client';
import { Board, Column, Task, Agent, Activity } from '@/types';

export interface WebhookData {
  type: string;
  agentId: string;
  sessionId: string;
  data?: {
    objective?: string;
    priority?: 'low' | 'medium' | 'high';
    result?: string;
  };
  timestamp: string;
  metadata?: {
    source?: string;
    label?: string;
    model?: string;
  };
}

export interface CombinedData {
  boards: Board[];
  columns: Column[];
  tasks: Task[];
  agents: Agent[];
  activities: Activity[];
}

export interface WebhookUpdateEvent {
  type: 'webhook-processed' | 'test-webhook' | 'full-sync' | 'connected';
  webhook?: WebhookData;
  result?: {
    action: string;
    ticketId?: string;
    agentId?: string;
    reason?: string;
  };
  data?: CombinedData;
  message?: string;
}

class WebhookIntegrationService {
  private socket: Socket | null = null;
  private baseUrl: string;
  private listeners: Map<string, Function[]> = new Map();
  private isConnected = false;

  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  // Initialize WebSocket connection
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.baseUrl);

        this.socket.on('connect', () => {
          console.log('🔗 Connected to webhook integration server');
          this.isConnected = true;
          this.emit('connected', { type: 'connected', message: 'WebSocket connected' });
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('🔌 Disconnected from webhook integration server');
          this.isConnected = false;
          this.emit('disconnected', { type: 'disconnected', message: 'WebSocket disconnected' });
        });

        this.socket.on('live-data-update', (event: WebhookUpdateEvent) => {
          console.log('📨 Received live data update:', event.type);
          this.emit('live-data-update', event);
        });

        // Handle connection errors
        this.socket.on('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000); // 10 second timeout

      } catch (error) {
        reject(error);
      }
    });
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Event listener management
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // API Methods
  async fetchCombinedData(): Promise<CombinedData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/data/combined`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching combined data:', error);
      throw error;
    }
  }

  async fetchLiveData(): Promise<CombinedData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/data/live`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching live data:', error);
      throw error;
    }
  }

  async fetchMigrationData(): Promise<CombinedData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/data/migration`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching migration data:', error);
      throw error;
    }
  }

  async sendTestWebhook(data: { objective?: string; priority?: string; label?: string }) {
    try {
      const response = await fetch(`${this.baseUrl}/api/test/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error sending test webhook:', error);
      throw error;
    }
  }

  async checkServerHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error checking server health:', error);
      throw error;
    }
  }

  // Utility methods
  getConnectionStatus() {
    return this.isConnected;
  }

  getSocketId() {
    return this.socket?.id;
  }
}

// Export singleton instance
export const webhookService = new WebhookIntegrationService();

// Export class for testing or multiple instances
export default WebhookIntegrationService;