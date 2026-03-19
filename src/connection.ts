import { Socket } from 'net';
import { EventEmitter } from 'events';
import type { QueuedCommand } from './types';
import { KeyenceError, TimeoutError } from './errors';

/**
 * Manages the TCP socket connection and command queue for Keyence PLC communication.
 *
 * Responsibilities:
 * - TCP socket lifecycle (connect, disconnect, destroy)
 * - Auto-reconnect logic
 * - Command queuing with timeout
 * - Response buffer parsing
 */
export class Connection extends EventEmitter {
    private socket: Socket;
    private readonly host: string;
    private readonly port: number;
    private readonly timeout: number;
    private readonly station?: number;
    private readonly autoReconnect: boolean;
    private readonly reconnectInterval: number;

    private connected: boolean = false;
    private buffer: string = '';
    private queue: QueuedCommand[] = [];

    private reconnectTimer?: NodeJS.Timeout;
    private reconnectAttempts: number = 0;
    private isManualDisconnect: boolean = false;
    private isConnecting: boolean = false;

    constructor(
        host: string,
        port: number,
        timeout: number,
        autoReconnect: boolean,
        reconnectInterval: number,
        station?: number,
    ) {
        super();
        this.host = host;
        this.port = port;
        this.timeout = timeout;
        this.station = station;
        this.autoReconnect = autoReconnect;
        this.reconnectInterval = reconnectInterval;
        this.socket = new Socket();
        this.bindSocketEvents(this.socket);
    }

    // ─── Socket Event Handling ───────────────────────────────────

    private bindSocketEvents(socket: Socket): void {
        socket.on('data', (data) => {
            this.buffer += data.toString('ascii');
            this.processBuffer();
        });

        socket.on('error', (err) => {
            this.emit('error', err);
        });

        socket.on('close', () => {
            const wasConnected = this.connected;
            this.connected = false;
            this.isConnecting = false;
            this.rejectAllPending(new Error('Socket closed'));

            if (wasConnected) {
                this.emit('disconnected');
            }

            if (this.autoReconnect && !this.isManualDisconnect) {
                this.scheduleReconnect();
            }
        });
    }

    private processBuffer(): void {
        let index: number;
        while ((index = this.buffer.indexOf('\r\n')) !== -1) {
            const response = this.buffer.substring(0, index);
            this.buffer = this.buffer.substring(index + 2);

            if (this.queue.length > 0) {
                const req = this.queue.shift()!;
                clearTimeout(req.timer);

                if (/^E\d+$/.test(response)) {
                    req.reject(new KeyenceError(response, req.command));
                } else {
                    req.resolve(response);
                }
            }
        }
    }

    private rejectAllPending(err: Error): void {
        while (this.queue.length > 0) {
            const req = this.queue.shift();
            if (req) {
                clearTimeout(req.timer);
                req.reject(err);
            }
        }
    }

    // ─── Reconnect Logic ─────────────────────────────────────────

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.isManualDisconnect) {
            return;
        }

        this.reconnectAttempts++;
        this.emit('reconnecting', this.reconnectAttempts);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = undefined;
            try {
                await this.connect();
            } catch {
                // Will trigger another reconnect via 'close' event
            }
        }, this.reconnectInterval);
    }

    private stopReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    // ─── Public Connection API ───────────────────────────────────

    /**
     * Establishes TCP connection and initializes the Host Link session (CR command).
     */
    public connect(): Promise<void> {
        if (this.connected) {
            return Promise.resolve();
        }

        if (this.isConnecting) {
            return Promise.reject(new Error('Connection already in progress'));
        }

        this.isConnecting = true;
        this.isManualDisconnect = false;

        // If socket was destroyed, create a new one first
        if (this.socket.destroyed) {
            this.socket = new Socket();
            this.bindSocketEvents(this.socket);
        }

        return new Promise((resolve, reject) => {
            const onConnect = async () => {
                this.socket.removeListener('error', onError);
                try {
                    const cmd = this.station !== undefined
                        ? `CR ${this.station.toString().padStart(2, '0')}`
                        : 'CR';
                    await this.sendCommand(cmd, true);
                    this.connected = true;
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.emit('connected');
                    resolve();
                } catch (err) {
                    this.isConnecting = false;
                    this.socket.destroy();
                    reject(err);
                }
            };

            const onError = (err: Error) => {
                this.socket.removeListener('connect', onConnect);
                this.isConnecting = false;
                reject(err);
            };

            this.socket.once('connect', onConnect);
            this.socket.once('error', onError);
            this.socket.connect(this.port, this.host);
        });
    }

    /**
     * Disconnects from the PLC safely.
     */
    public async disconnect(): Promise<void> {
        this.isManualDisconnect = true;
        this.stopReconnect();

        if (this.connected) {
            try {
                await this.sendCommand('CQ');
            } catch {
                // Ignore errors on disconnect
            }
            this.connected = false;
        }

        this.socket.destroy();

        // Only emit if we haven't already emitted via the close handler
        // (socket.destroy triggers 'close' which emits 'disconnected' if wasConnected)
        // Since we set connected=false before destroy, the close handler won't emit again.
        this.emit('disconnected');
    }

    /**
     * Force reconnect (destroy current connection and reconnect).
     */
    public async reconnect(): Promise<void> {
        this.isManualDisconnect = false;
        this.stopReconnect();

        if (this.connected) {
            this.socket.destroy();
            this.connected = false;
        }

        await this.connect();
    }

    /**
     * Check if currently connected to PLC.
     */
    public isConnected(): boolean {
        return this.connected;
    }

    // ─── Command Interface ───────────────────────────────────────

    /**
     * Send an ASCII command to the PLC and return the response.
     * @param command - The raw command string (without CR/LF terminator)
     * @param isInit  - If true, skip the connection check (used for CR init command)
     */
    public sendCommand(command: string, isInit: boolean = false): Promise<string> {
        if (!this.connected && !isInit) {
            return Promise.reject(new Error('Not connected to PLC'));
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const index = this.queue.findIndex(q => q.timer === timer);
                if (index !== -1) {
                    const req = this.queue.splice(index, 1)[0];
                    req.reject(new TimeoutError(req.command));
                }
            }, this.timeout);

            this.queue.push({ command, resolve, reject, timer });
            this.socket.write(command + '\r');
        });
    }
}
