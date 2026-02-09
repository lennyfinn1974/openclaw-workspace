import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import { IPCRequest, IPCResponse, IPCRequestType } from '../types/ipc';
import { v4 as uuid } from 'uuid';

export class PythonBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingRequests = new Map<string, {
    resolve: (resp: IPCResponse) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private connected = false;
  private readonly pythonPath: string;
  private readonly enginePath: string;
  private readonly requestTimeoutMs: number;

  constructor(opts?: { pythonPath?: string; requestTimeoutMs?: number }) {
    super();
    const projectRoot = path.resolve(__dirname, '..', '..');
    this.pythonPath = opts?.pythonPath || path.join(projectRoot, 'venv', 'bin', 'python');
    this.enginePath = path.join(projectRoot, 'python', 'engine.py');
    this.requestTimeoutMs = opts?.requestTimeoutMs || 30000;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.pythonPath, [this.enginePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this.process.stdout!.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr!.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) this.emit('log', msg);
      });

      this.process.on('error', (err) => {
        this.connected = false;
        this.emit('error', err);
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.connected = false;
        this.emit('exit', code);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Python process exited with code ${code}`));
        }
        this.pendingRequests.clear();
      });

      // Verify connection with a health ping
      setTimeout(async () => {
        try {
          const resp = await this.request('health:ping', {});
          if (resp.success) {
            this.connected = true;
            this.emit('connected');
            resolve();
          } else {
            reject(new Error('Python bridge health check failed'));
          }
        } catch (err) {
          reject(err);
        }
      }, 500);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response: IPCResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch (err) {
        this.emit('log', `[PythonBridge] Invalid JSON from Python: ${line.substring(0, 200)}`);
      }
    }
  }

  async request(type: IPCRequestType, payload: any): Promise<IPCResponse> {
    if (!this.process || this.process.killed) {
      throw new Error('Python bridge not running');
    }

    const req: IPCRequest = {
      id: uuid(),
      type,
      payload,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(req.id);
        reject(new Error(`Request ${type} timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(req.id, { resolve, reject, timeout });

      const json = JSON.stringify(req) + '\n';
      this.process!.stdin!.write(json, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(req.id);
          reject(err);
        }
      });
    });
  }

  isConnected(): boolean {
    return this.connected && !!this.process && !this.process.killed;
  }

  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);
        this.process!.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.process = null;
    this.connected = false;
  }
}
