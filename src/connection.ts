import { Socket } from 'net';
import { EventEmitter } from 'events';
import type { QueuedCommand } from './types';
import { ConnectionError, KeyenceError, TimeoutError } from './errors';

/**
 * 管理与基恩士 PLC 通信的 TCP 套接字连接和指令队列。
 *
 * 职责:
 * - TCP 套接字生命周期 (连接，断开，销毁)
 * - 自动重连逻辑
 * - 带有超时机制的指令队列
 * - 响应 buffer 解析
 */
export class Connection extends EventEmitter {
    private socket: Socket;
    private readonly host: string;
    private readonly port: number;
    private readonly timeout: number;
    private readonly station?: number;
    private readonly autoReconnect: boolean;
    private readonly reconnectInterval: number;
    private readonly noDelay: boolean;
    private readonly keepAlive: boolean;
    private readonly keepAliveInitialDelay: number;
    private readonly maxPendingCommands: number;

    private connected: boolean = false;
    private buffer: string = '';
    private queue: QueuedCommand[] = [];
    private activeCommand?: QueuedCommand;

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
        noDelay: boolean,
        keepAlive: boolean,
        keepAliveInitialDelay: number,
        maxPendingCommands: number,
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
        this.noDelay = noDelay;
        this.keepAlive = keepAlive;
        this.keepAliveInitialDelay = keepAliveInitialDelay;
        this.maxPendingCommands = maxPendingCommands;
        this.configureSocket(this.socket);
        this.bindSocketEvents(this.socket);
    }

    // ─── Socket 事件处理 ───────────────────────────────────

    private configureSocket(socket: Socket): void {
        socket.setNoDelay(this.noDelay);
        socket.setKeepAlive(this.keepAlive, this.keepAliveInitialDelay);
    }

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
            this.buffer = '';
            this.rejectActiveAndPending(new ConnectionError('套接字已关闭'));

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
        // Host Link 协议的响应可以以 \r\n 结尾，或者仅以 \r 结尾。
        // 我们同时处理这两种情况，优先处理 \r\n 以避免留下尾随的 \n。
        while (true) {
            const indexCRLF = this.buffer.indexOf('\r\n');
            const indexCR = this.buffer.indexOf('\r');
            
            if (indexCRLF !== -1 && (indexCR === -1 || indexCRLF <= indexCR)) {
                index = indexCRLF;
                const response = this.buffer.substring(0, index);
                this.buffer = this.buffer.substring(index + 2);
                this.resolveNext(response);
            } else if (indexCR !== -1) {
                index = indexCR;
                const response = this.buffer.substring(0, index);
                this.buffer = this.buffer.substring(index + 1);
                this.resolveNext(response);
            } else {
                break;
            }
        }
    }

    private resolveNext(response: string): void {
        const req = this.activeCommand;
        if (!req) {
            this.emit('error', new ConnectionError(`收到意外的 PLC 响应且没有活动指令: ${response}`));
            return;
        }

        this.activeCommand = undefined;
        if (req.timer) {
            clearTimeout(req.timer);
        }

        if (/^E\d+$/.test(response)) {
            req.reject(new KeyenceError(response, req.command));
        } else {
            req.resolve(response);
        }

        this.flushQueue();
    }

    private rejectAllPending(err: Error): void {
        while (this.queue.length > 0) {
            const req = this.queue.shift();
            if (req) {
                if (req.timer) {
                    clearTimeout(req.timer);
                }
                req.reject(err);
            }
        }
    }

    private rejectActiveAndPending(err: Error): void {
        const active = this.activeCommand;
        this.activeCommand = undefined;

        if (active) {
            if (active.timer) {
                clearTimeout(active.timer);
            }
            active.reject(err);
        }

        this.rejectAllPending(err);
    }

    private flushQueue(): void {
        if (this.activeCommand || this.queue.length === 0 || this.socket.destroyed) {
            return;
        }

        const req = this.queue.shift()!;
        req.timer = setTimeout(() => {
            if (this.activeCommand !== req) {
                return;
            }

            this.activeCommand = undefined;
            req.reject(new TimeoutError(req.command));

            // 超时后，我们无法再信任请求/响应的对齐状态。
            this.socket.destroy();
        }, this.timeout);

        this.activeCommand = req;
        this.socket.write(req.command + '\r');
    }

    // ─── 重连逻辑 ─────────────────────────────────────────

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
                // 将通过 'close' 事件触发下一次重连
            }
        }, this.reconnectInterval);
    }

    private stopReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    // ─── 公共连接 API ───────────────────────────────────

    /**
     * 建立 TCP 连接并初始化 Host Link 会话（通过 CR 指令）。
     */
    public connect(): Promise<void> {
        if (this.connected) {
            return Promise.resolve();
        }

        if (this.isConnecting) {
            return Promise.reject(new Error('已经正在连接中'));
        }

        this.isConnecting = true;
        this.isManualDisconnect = false;

        // 如果套接字已销毁，首先创建一个新的
        if (this.socket.destroyed) {
            this.socket = new Socket();
            this.configureSocket(this.socket);
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
     * 安全地断开与 PLC 的连接。
     */
    public async disconnect(): Promise<void> {
        this.isManualDisconnect = true;
        this.stopReconnect();

        if (this.connected) {
            try {
                await this.sendCommand('CQ');
            } catch {
                // 忽略断开连接时的错误
            }
            this.connected = false;
        }

        this.socket.destroy();

        // 仅在我们还没有通过 close 处理程序触发时发出事件
        // (socket.destroy 会触发 'close'，如果 wasConnected，就会发出 'disconnected')
        // 由于我们在 destroy 之前将 connected 设置为 false，因此 close 处理程序不会再次发出。
        this.emit('disconnected');
    }

    /**
     * 强制重连 (销毁当前连接并重新连接)。
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
     * 检查当前是否已连接到 PLC。
     */
    public isConnected(): boolean {
        return this.connected;
    }

    // ─── 指令接口 ───────────────────────────────────────

    /**
     * 发送一条 ASCII 指令给 PLC 并返回响应。
     * @param command - 原始指令字符串 (不包含 CR/LF 终止符)
     * @param isInit  - 如果为 true，则跳过连接检查 (用于 CR 初始指令)
     */
    public sendCommand(command: string, isInit: boolean = false): Promise<string> {
        if (!this.connected && !isInit) {
            return Promise.reject(new ConnectionError('未连接到 PLC'));
        }

        if (this.queue.length >= this.maxPendingCommands) {
            return Promise.reject(
                new ConnectionError(
                    `PLC 指令队列超出限制 (${this.maxPendingCommands})`,
                ),
            );
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ command, resolve, reject });
            this.flushQueue();
        });
    }
}
