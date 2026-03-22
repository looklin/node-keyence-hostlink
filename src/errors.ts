/**
 * 基恩士 PLC 错误代码映射。
 */
const PLC_ERROR_MAP: Record<string, string> = {
    'E0': '设备号错误',
    'E1': '指令错误',
    'E2': '设备格式错误',
    'E4': '写保护',
    'E5': '程序错误',
    'E6': '数据错误',
};

/**
 * 基恩士 PLC 错误的自定义错误类。
 */
export class KeyenceError extends Error {
    public readonly code: string;
    public readonly command: string;

    constructor(code: string, command: string) {
        const description = PLC_ERROR_MAP[code] ?? 'Unknown Error';
        super(`PLC 错误: ${code}: ${description} (指令: ${command.trim()})`);
        this.name = 'KeyenceError';
        this.code = code;
        this.command = command;
    }
}

/**
 * 连接相关错误的自定义错误类。
 */
export class ConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}

/**
 * 指令超时错误的自定义错误类。
 */
export class TimeoutError extends Error {
    public readonly command: string;

    constructor(command: string) {
        super(`PLC 指令超时 (指令: ${command.trim()})`);
        this.name = 'TimeoutError';
        this.command = command;
    }
}
