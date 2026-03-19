/**
 * Configuration options for connecting to a Keyence PLC.
 */
export interface KeyenceOptions {
    /** PLC IP Address (required) */
    host: string;
    /** PLC Port (default: 8501) */
    port?: number;
    /** Command timeout in ms (default: 5000) */
    timeout?: number;
    /** Station number for multi-drop RS485-over-TCP */
    station?: number;
    /** Enable auto reconnect (default: true) */
    autoReconnect?: boolean;
    /** Reconnect interval in ms (default: 3000) */
    reconnectInterval?: number;
}

/**
 * Typed event signatures for KeyencePLC.
 */
export interface KeyenceEvents {
    connected: () => void;
    disconnected: () => void;
    reconnecting: (attempt: number) => void;
    error: (err: Error) => void;
}

/**
 * A pending command in the queue.
 */
export interface QueuedCommand {
    command: string;
    resolve: (value: string) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
}
