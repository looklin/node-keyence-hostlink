/**
 * node-keyence-hostlink
 *
 * A lightweight Node.js library for communicating with Keyence PLCs
 * using the Host Link Protocol over TCP/IP.
 */

// Main class
export { KeyencePLC } from './keyence-plc';

// Types
export type { KeyenceOptions, KeyenceEvents } from './types';

// Errors (for consumers to catch specific error types)
export { KeyenceError, ConnectionError, TimeoutError } from './errors';

// Utilities
export { stripSuffix } from './device';