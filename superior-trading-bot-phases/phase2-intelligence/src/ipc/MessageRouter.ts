import { PythonBridge } from './PythonBridge';
import { IPCRequestType, IPCResponse } from '../types/ipc';

export class MessageRouter {
  private bridge: PythonBridge;
  private requestCounts = new Map<string, number>();
  private totalLatencyMs = 0;
  private totalRequests = 0;

  constructor(bridge: PythonBridge) {
    this.bridge = bridge;
  }

  async send(type: IPCRequestType, payload: any): Promise<any> {
    if (!this.bridge.isConnected()) {
      throw new Error(`Python bridge not connected, cannot send ${type}`);
    }

    const start = Date.now();
    const response: IPCResponse = await this.bridge.request(type, payload);
    const elapsed = Date.now() - start;

    this.totalLatencyMs += elapsed;
    this.totalRequests++;
    this.requestCounts.set(type, (this.requestCounts.get(type) || 0) + 1);

    if (!response.success) {
      throw new Error(`IPC ${type} failed: ${response.error}`);
    }

    return response.payload;
  }

  getStats() {
    return {
      totalRequests: this.totalRequests,
      avgLatencyMs: this.totalRequests > 0 ? Math.round(this.totalLatencyMs / this.totalRequests) : 0,
      requestsByType: Object.fromEntries(this.requestCounts)
    };
  }
}
