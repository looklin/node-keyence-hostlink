/**
 * 连接到基恩士 PLC 的配置选项。
 */
export interface KeyenceOptions {
    /** PLC IP 地址 (必填) */
    host: string;
    /** PLC 端口 (默认: 8501) */
    port?: number;
    /** 指令超时时间 (毫秒) (默认: 5000) */
    timeout?: number;
    /** 多站 RS485-over-TCP 的站号 */
    station?: number;
    /** 是否开启自动重连 (默认: true) */
    autoReconnect?: boolean;
    /** 重连间隔时间 (毫秒) (默认: 3000) */
    reconnectInterval?: number;
    /** 禁用 Nagle 算法以降低小请求/响应的延迟 (默认: true) */
    noDelay?: boolean;
    /** 为长期存活的 PLC 会话启用 TCP keepalive 探测 (默认: true) */
    keepAlive?: boolean;
    /** 首次 keepalive 探测前的初始延迟 (毫秒) (默认: 1000) */
    keepAliveInitialDelay?: number;
    /** 在自动分块前，每个读指令最大的连续点数 (默认: 64) */
    maxReadPoints?: number;
    /** 在自动分块前，每个写指令最大的连续点数 (默认: 64) */
    maxWritePoints?: number;
    /** 在活动请求后排队等待的最大指令数 (默认: 128) */
    maxPendingCommands?: number;
}

/**
 * KeyencePLC 的类型化事件签名。
 */
export interface KeyenceEvents {
    connected: () => void;
    disconnected: () => void;
    reconnecting: (attempt: number) => void;
    error: (err: Error) => void;
}

/**
 * 队列中待处理的指令。
 */
export interface QueuedCommand {
    command: string;
    resolve: (value: string) => void;
    reject: (err: Error) => void;
    timer?: NodeJS.Timeout;
}
