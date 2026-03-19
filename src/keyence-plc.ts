import { Connection } from './connection';
import { WordOperations, BitOperations, TypedOperations } from './operations';
import type { KeyenceOptions, KeyenceEvents } from './types';

/**
 * Main class for communicating with Keyence PLCs via Host Link Protocol.
 *
 * Provides a unified API that delegates to specialized modules:
 * - Connection: TCP lifecycle, reconnect, command queue
 * - WordOperations: Single/multi word read/write
 * - BitOperations: Boolean (bit) read/write
 * - TypedOperations: Int16/32, UInt16/32, String read/write
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
            options.station,
        );

        this.wordOps = new WordOperations(this.conn);
        this.bitOps = new BitOperations(this.conn);
        this.typedOps = new TypedOperations(this.wordOps);
    }

    // ─── Event Forwarding ────────────────────────────────────────

    /** Register an event listener. */
    on<K extends keyof KeyenceEvents>(event: K, listener: KeyenceEvents[K]): this {
        this.conn.on(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /** Register a one-time event listener. */
    once<K extends keyof KeyenceEvents>(event: K, listener: KeyenceEvents[K]): this {
        this.conn.once(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /** Remove an event listener. */
    off<K extends keyof KeyenceEvents>(event: K, listener: KeyenceEvents[K]): this {
        this.conn.off(event, listener as (...args: unknown[]) => void);
        return this;
    }

    /** Emit an event. */
    emit<K extends keyof KeyenceEvents>(event: K, ...args: Parameters<KeyenceEvents[K]>): boolean {
        return this.conn.emit(event, ...args);
    }

    // ─── Connection ──────────────────────────────────────────────

    /** Establishes TCP connection and initializes the session. */
    connect(): Promise<void> {
        return this.conn.connect();
    }

    /** Disconnects from the PLC safely. */
    disconnect(): Promise<void> {
        return this.conn.disconnect();
    }

    /** Force reconnect (disconnect then connect). */
    reconnect(): Promise<void> {
        return this.conn.reconnect();
    }

    /** Check if currently connected to PLC. */
    isConnected(): boolean {
        return this.conn.isConnected();
    }

    // ─── Word Read / Write ───────────────────────────────────────

    /** Read a single device value as a string. */
    read(device: string): Promise<string> {
        return this.wordOps.read(device);
    }

    /** Read multiple consecutive device values. */
    readMulti(device: string, count: number): Promise<string[]> {
        return this.wordOps.readMulti(device, count);
    }

    /** Write a value to a single device. */
    write(device: string, value: string | number): Promise<boolean> {
        return this.wordOps.write(device, value);
    }

    /** Write multiple values to consecutive devices. */
    writeMulti(device: string, values: (string | number)[]): Promise<boolean> {
        return this.wordOps.writeMulti(device, values);
    }

    // ─── Bit / Boolean Read / Write ──────────────────────────────

    /** Read a single boolean (bit) value. */
    readBool(device: string): Promise<boolean> {
        return this.bitOps.readBool(device);
    }

    /** Read multiple consecutive boolean (bit) values. */
    readBoolMulti(device: string, count: number): Promise<boolean[]> {
        return this.bitOps.readBoolMulti(device, count);
    }

    /** Write a single boolean (bit) value using ST/RS commands. */
    writeBool(device: string, value: boolean): Promise<boolean> {
        return this.bitOps.writeBool(device, value);
    }

    /** Write multiple consecutive boolean (bit) values. */
    writeBoolMulti(device: string, values: boolean[]): Promise<boolean> {
        return this.bitOps.writeBoolMulti(device, values);
    }

    // ─── Typed Word Read / Write ─────────────────────────────────

    /** Read a 16-bit Unsigned Integer. */
    readUInt16(device: string): Promise<number> {
        return this.typedOps.readUInt16(device);
    }

    /** Read a 16-bit Signed Integer. */
    readInt16(device: string): Promise<number> {
        return this.typedOps.readInt16(device);
    }

    /** Read a 32-bit Unsigned Integer (Double Word). */
    readUInt32(device: string): Promise<number> {
        return this.typedOps.readUInt32(device);
    }

    /** Read a 32-bit Signed Integer (Double Word). */
    readInt32(device: string): Promise<number> {
        return this.typedOps.readInt32(device);
    }

    /** Write a 16-bit Unsigned Integer. */
    writeUInt16(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeUInt16(device, value);
    }

    /** Write a 16-bit Signed Integer. */
    writeInt16(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeInt16(device, value);
    }

    /** Write a 32-bit Unsigned Integer (Double Word). */
    writeUInt32(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeUInt32(device, value);
    }

    /** Write a 32-bit Signed Integer (Double Word). */
    writeInt32(device: string, value: number): Promise<boolean> {
        return this.typedOps.writeInt32(device, value);
    }

    /** Read a string from consecutive word devices. */
    readString(device: string, length: number): Promise<string> {
        return this.typedOps.readString(device, length);
    }

    /** Write a string to consecutive word devices. */
    writeString(device: string, text: string): Promise<boolean> {
        return this.typedOps.writeString(device, text);
    }
}
