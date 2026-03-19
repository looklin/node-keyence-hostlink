/**
 * Keyence PLC error code mapping.
 */
const PLC_ERROR_MAP: Record<string, string> = {
    'E0': 'Device Number Error',
    'E1': 'Command Error',
    'E2': 'Device Format Error',
    'E4': 'Write Protected',
    'E5': 'Program Error',
    'E6': 'Data Error',
};

/**
 * Custom error class for Keyence PLC errors.
 */
export class KeyenceError extends Error {
    public readonly code: string;
    public readonly command: string;

    constructor(code: string, command: string) {
        const description = PLC_ERROR_MAP[code] ?? 'Unknown Error';
        super(`PLC Error: ${code}: ${description} (Command: ${command.trim()})`);
        this.name = 'KeyenceError';
        this.code = code;
        this.command = command;
    }
}

/**
 * Custom error class for connection-related errors.
 */
export class ConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}

/**
 * Custom error class for command timeout errors.
 */
export class TimeoutError extends Error {
    public readonly command: string;

    constructor(command: string) {
        super(`PLC Command Timeout (Command: ${command.trim()})`);
        this.name = 'TimeoutError';
        this.command = command;
    }
}
