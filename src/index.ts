/**
 * node-keyence-hostlink
 *
 * 一个轻量级的 Node.js 库，用于通过 TCP/IP 上的
 * Host Link Protocol (上位链路协议) 与基恩士 PLC 通信。
 */

// 主类
export { KeyencePLC } from './keyence-plc';

// 类型
export type { KeyenceOptions, KeyenceEvents } from './types';

// 错误 (供使用者捕获特定的错误类型)
export { KeyenceError, ConnectionError, TimeoutError } from './errors';

// 工具函数
export { stripSuffix, incrementDevice } from './device';
