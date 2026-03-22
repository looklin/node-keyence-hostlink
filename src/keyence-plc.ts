import { Connection } from './connection';
import { WordOperations, BitOperations, TypedOperations } from './operations';
import type { KeyenceOptions, KeyenceEvents } from './types';

/**
 * 通过 Host Link Protocol (上位链路协议) 与基恩士 PLC 通信的主类。
 *
 * 提供一个统一的 API，该 API 将工作委托给各个专用模块：
 * - Connection: TCP 生命周期，重连机制，指令队列
 * - WordOperations: 单字/多字读写
 * - BitOperations: 布尔 (位) 读写
 * - TypedOperations: Int16/32, UInt16/32, 字符串读写
 */
export class KeyencePLC {
    private readonly conn: Connection;
    private readonly wordOps: WordOperations;
    private readonly bitOps: BitOperations;
    private readonly typedOps: TypedOperations;

    constructor(options: KeyenceOptions) {
        this.conn = new Connection(
            options.host,
            options.port ?? 8501,
            options.timeout ?? 5000,
            options.autoReconnect !== false,
            options.reconnectInterval ?? 3000,
            options.noDelay !== false,
            options.keepAlive !== false,
            options.keepAliveInitialDelay ?? 1000,
            options.maxPendingCommands ?? 128,
            options.station,
        );

        this.wordOps = new WordOperations(
            this.conn,
            options.maxReadPoints ?? 64,
            options.maxWritePoints ?? 64,
        );
        this.bitOps = new BitOperations(
            this.conn,
            options.maxReadPoints ?? 64,
            options.maxWritePoints ?? 64,
        );
        this.typedOps = new TypedOperations(this.wordOps);
    }

    // ─── 事件转发 ────────────────────────────────────────

    /** 注册一个事件监听器。 */
    on<K extends keyof KeyenceEvents>(event: K, listener: KeyenceEvents[K]): this {
        this.conn.on(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /** 注册一个一次性事件监听器。 */
    once<K extends keyof KeyenceEvents>(event: K, listener: KeyenceEvents[K]): this {
        this.conn.once(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /** 移除事件监听器。 */
    off<K extends keyof KeyenceEvents>(event: K, listener: KeyenceEvents[K]): this {
        this.conn.off(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /** 触发事件。 */
    emit<K extends keyof KeyenceEvents>(event: K, ...args: Parameters<KeyenceEvents[K]>): boolean {
        return this.conn.emit(event, ...args);
    }

    // ─── 连接 ──────────────────────────────────────────────

    /** 建立 TCP 连接并初始化会话。 */
    connect(): Promise<void> {
        return this.conn.connect();
    }

    /** 安全地断开与 PLC 的连接。 */
    disconnect(): Promise<void> {
        return this.conn.disconnect();
    }

    /** 强制重连 (断开连接然后重新连接)。 */
    reconnect(): Promise<void> {
        return this.conn.reconnect();
    }

    /** 检查当前是否已连接到 PLC。 */
    isConnected(): boolean {
        return this.conn.isConnected();
    }

    // ─── 字 (Word) 读 / 写 ───────────────────────────────────────

    /** 读取单个设备值并作为字符串返回。 */
    read(device: string): Promise<string> {
        return this.wordOps.read(device);
    }

    /** 读取多个连续设备的值。 */
    readMulti(device: string, count: number): Promise<string[]> {
        return this.wordOps.readMulti(device, count);
    }

    /** 向单个设备写入一个值。 */
    write(device: string, value: string | number): Promise<boolean> {
        return this.wordOps.write(device, value);
    }

    /** 向连续的设备写入多个值。 */
    writeMulti(device: string, values: (string | number)[]): Promise<boolean> {
        return this.wordOps.writeMulti(device, values);
    }

    // ─── 位 / 布尔 读 / 写 ──────────────────────────────

    /** 读取单个布尔 (位) 值。 */
    readBool(device: string): Promise<boolean> {
        return this.bitOps.readBool(device);
    }

    /** 读取多个连续的布尔 (位) 值。 */
    readBoolMulti(device: string, count: number): Promise<boolean[]> {
        return this.bitOps.readBoolMulti(device, count);
    }

    /** 使用 ST/RS 指令写入单个布尔 (位) 值。 */
    writeBool(device: string, value: boolean): Promise<boolean> {
        return this.bitOps.writeBool(device, value);
    }

    /** 连续写入多个布尔 (位) 值。 */
    writeBoolMulti(device: string, values: boolean[]): Promise<boolean> {
        return this.bitOps.writeBoolMulti(device, values);
    }

    // ─── 带类型的字读 / 写 ─────────────────────────────────

    /** 读取 16 位无符号整数。 */
    readUInt16(device: string): Promise<number> {
        return this.typedOps.readUInt16(device);
    }

    /** 读取 16 位有符号整数。 */
    readInt16(device: string): Promise<number> {
        return this.typedOps.readInt16(device);
    }

    /** 读取 32 位无符号整数 (双字)。 */
    readUInt32(device: string): Promise<number> {
        return this.typedOps.readUInt32(device);
    }

    /** 读取 32 位有符号整数 (双字)。 */
    readInt32(device: string): Promise<number> {
        return this.typedOps.readInt32(device);
    }

    /** 写入 16 位无符号整数。 */
    writeUInt16(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeUInt16(device, value);
    }

    /** 写入 16 位有符号整数。 */
    writeInt16(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeInt16(device, value);
    }

    /** 写入 32 位无符号整数 (双字)。 */
    writeUInt32(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeUInt32(device, value);
    }

    /** 写入 32 位有符号整数 (双字)。 */
    writeInt32(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeInt32(device, value);
    }

    /** 从连续字设备中读取字符串。 */
    readString(device: string, length: number): Promise<string> {
        return this.typedOps.readString(device, length);
    }

    /** 将字符串写入连续字设备。 */
    writeString(device: string, text: string): Promise<boolean> {
        return this.typedOps.writeString(device, text);
    }
}
