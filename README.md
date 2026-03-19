# node-keyence-hostlink

A lightweight and robust Node.js library for communicating with Keyence PLCs using the **Host Link Protocol** (上位链路协议) over TCP/IP.

Read and write data from/to various PLC memory areas such as **DM (Data Memory), EM, FM, R, B, MR, LR, CR** and more.

## Features

- 🔌 **Auto Reconnect** — Automatic reconnection on connection loss with configurable interval
- 📡 **Multi-Drop Support** — Optional station number for RS485-over-TCP setups
- 📝 **Word Operations** — Single and multi-word Read / Write (`RD`, `WR`, `RDS`, `WRS`)
- 🔢 **Typed Read/Write** — Built-in helpers for `Int16`, `UInt16`, `Int32`, `UInt32`, `String`
- 🔘 **Bit/Boolean Operations** — Set / Reset bits via `ST` / `RS` commands (`R`, `B`, `MR`, `LR`, `CR`, etc.)
- ⚠️ **Structured Errors** — Custom error classes (`KeyenceError`, `TimeoutError`) with PLC error code mapping
- 📣 **Type-safe Events** — `connected`, `disconnected`, `reconnecting`, `error`
- ⏳ **Promise-based** — Full `async/await` API with built-in command queue
- 🏗️ **Modular Architecture** — Clean separation of connection, operations, and protocol logic
- 📦 **TypeScript** — Written in TypeScript with full type definitions

## Installation

```bash
npm install node-keyence-hostlink
```

## Quick Start

```javascript
const { KeyencePLC } = require('node-keyence-hostlink');

async function main() {
    const plc = new KeyencePLC({
        host: '192.168.0.10',
        port: 8501,
        timeout: 5000,
        autoReconnect: true,
        reconnectInterval: 3000,
    });

    plc.on('connected', () => console.log('PLC connected!'));
    plc.on('disconnected', () => console.log('PLC disconnected!'));
    plc.on('reconnecting', (attempt) => console.log(`Reconnecting... #${attempt}`));
    plc.on('error', (err) => console.error('Error:', err.message));

    await plc.connect();

    // Word read/write
    await plc.write('DM100', 1234);
    console.log(await plc.read('DM100')); // "1234"

    // Typed read/write
    await plc.writeInt32('DM300', -99999);
    console.log(await plc.readInt32('DM300')); // -99999

    // Boolean read/write
    await plc.writeBool('R100', true);
    console.log(await plc.readBool('R100')); // true

    await plc.disconnect();
}

main();
```

> See [`example.js`](./example.js) for a comprehensive usage example.

## Supported Data Type Suffixes

Keyence PLCs support data-type suffixes appended to device names. You can pass them directly:

| Suffix | Description | Example |
|--------|-------------|---------|
| `.U` | Unsigned 16-bit | `DM100.U` |
| `.S` | Signed 16-bit | `DM100.S` |
| `.D` | Unsigned 32-bit | `DM100.D` |
| `.L` | Signed 32-bit | `DM100.L` |
| `.H` | Hexadecimal 16-bit | `DM100.H` |

```javascript
await plc.read('DM100.L');           // 32-bit signed
await plc.write('DM100.L', 999999);
```

## API Reference

### `new KeyencePLC(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | — | PLC IP Address *(required)* |
| `port` | `number` | `8501` | PLC Port |
| `timeout` | `number` | `5000` | Command timeout in ms |
| `station` | `number` | — | Station number for multi-drop |
| `autoReconnect` | `boolean` | `true` | Enable auto reconnect |
| `reconnectInterval` | `number` | `3000` | Reconnect interval in ms |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | — | Emitted when connected to PLC |
| `disconnected` | — | Emitted when disconnected from PLC |
| `reconnecting` | `attempt: number` | Emitted on each reconnect attempt |
| `error` | `err: Error` | Emitted on connection error |

### Connection Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Establish TCP connection and init session |
| `disconnect()` | `Promise<void>` | Close connection safely |
| `reconnect()` | `Promise<void>` | Force disconnect and reconnect |
| `isConnected()` | `boolean` | Check connection status |

### Word Read / Write

| Method | Returns | Description |
|--------|---------|-------------|
| `read(device)` | `Promise<string>` | Read a single device |
| `readMulti(device, count)` | `Promise<string[]>` | Read multiple consecutive devices |
| `write(device, value)` | `Promise<boolean>` | Write a single device |
| `writeMulti(device, values)` | `Promise<boolean>` | Write multiple consecutive devices |

### Typed Read / Write

| Method | Returns | Description |
|--------|---------|-------------|
| `readInt16(device)` | `Promise<number>` | Read 16-bit signed integer |
| `readUInt16(device)` | `Promise<number>` | Read 16-bit unsigned integer |
| `readInt32(device)` | `Promise<number>` | Read 32-bit signed integer |
| `readUInt32(device)` | `Promise<number>` | Read 32-bit unsigned integer |
| `writeInt16(device, value)` | `Promise<boolean>` | Write 16-bit signed integer |
| `writeUInt16(device, value)` | `Promise<boolean>` | Write 16-bit unsigned integer |
| `writeInt32(device, value)` | `Promise<boolean>` | Write 32-bit signed integer |
| `writeUInt32(device, value)` | `Promise<boolean>` | Write 32-bit unsigned integer |
| `readString(device, length)` | `Promise<string>` | Read string from consecutive words |
| `writeString(device, text)` | `Promise<boolean>` | Write string to consecutive words |

### Boolean (Bit) Read / Write

| Method | Returns | Description |
|--------|---------|-------------|
| `readBool(device)` | `Promise<boolean>` | Read a single bit |
| `writeBool(device, value)` | `Promise<boolean>` | Set or reset a single bit |
| `readBoolMulti(device, count)` | `Promise<boolean[]>` | Read multiple consecutive bits |
| `writeBoolMulti(device, values)` | `Promise<boolean>` | Write multiple consecutive bits |

## Error Handling

The library exports custom error classes for granular error handling:

```javascript
const { KeyencePLC, KeyenceError, TimeoutError } = require('node-keyence-hostlink');

try {
    await plc.read('DM99999');
} catch (err) {
    if (err instanceof KeyenceError) {
        // PLC returned an error code (E0, E1, E2, E4, E5, E6)
        console.error(`PLC Error [${err.code}]:`, err.message);
        console.error(`Failed command:`, err.command);
    } else if (err instanceof TimeoutError) {
        // Command timed out
        console.error('Timeout:', err.message);
    } else {
        // Connection or other error
        console.error('Error:', err.message);
    }
}
```

### PLC Error Codes

| Code | Description |
|------|-------------|
| `E0` | Device Number Error |
| `E1` | Command Error |
| `E2` | Device Format Error |
| `E4` | Write Protected |
| `E5` | Program Error |
| `E6` | Data Error |

## Project Structure

```
src/
├── index.ts          # Public exports
├── types.ts          # Interfaces and type definitions
├── errors.ts         # Custom error classes (KeyenceError, TimeoutError, ConnectionError)
├── connection.ts     # TCP connection management, reconnect logic, command queue
├── device.ts         # Device name utilities (suffix parsing)
├── operations.ts     # Word, Bit, and Typed R/W operations
└── keyence-plc.ts    # Main KeyencePLC class (composition of above modules)
```

## License

MIT