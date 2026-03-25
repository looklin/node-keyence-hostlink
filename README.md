# node-keyence-hostlink

一个轻量且健壮的 Node.js 库，用于通过 **Host Link Protocol** (上位链路协议) 在 TCP/IP 上与基恩士 (Keyence) PLC 进行通信。

支持读写各种 PLC 内存区域的数据，例如 **DM (Data Memory), EM, FM, R, B, MR, LR, CR** 等。

## 特性

- 🔌 **自动重连** — 连接断开时自动重连，支持可配置的时间间隔
- 📡 **多点支持** — 可选的站号 (station number)，用于 RS485-over-TCP 设置
- ⚡ **低延迟安全传输** — 单个在途指令，TCP no-delay，超时触发会话重置
- 📝 **字操作** — 单字和多字的读 / 写 (`RD`, `WR`, `RDS`, `WRS`)
- 🔢 **带类型的读写** — 内置支持 `Int16`, `UInt16`, `Int32`, `UInt32`, `String`
- 🔘 **位/布尔操作** — 通过 `ST` / `RS` 指令置位 / 复位 (`R`, `B`, `MR`, `LR`, `CR` 等)
- ✂️ **自动分块** — 大型连续读写操作会自动根据配置分块
- ⚠️ **结构化错误** — 自定义错误类 (`KeyenceError`, `TimeoutError`) 以及 PLC 错误代码映射
- 📣 **类型安全的事件** — `connected`, `disconnected`, `reconnecting`, `error`
- ⏳ **基于 Promise** — 完整的 `async/await` API 以及内置指令队列
- 🏗️ **模块化架构** — 连接、操作和协议逻辑的清晰分离
- 📦 **TypeScript** — 使用 TypeScript 编写，提供完整的类型定义

## 安装

```bash
npm install node-keyence-hostlink
```

## 快速开始

```javascript
const { KeyencePLC } = require('node-keyence-hostlink');

async function main() {
    const plc = new KeyencePLC({
        host: '192.168.0.10',
        port: 8501,
        timeout: 5000,
        autoReconnect: true,
        reconnectInterval: 3000,
        maxReadPoints: 64,
        maxWritePoints: 64,
    });

    plc.on('connected', () => console.log('PLC 已连接!'));
    plc.on('disconnected', () => console.log('PLC 已断开连接!'));
    plc.on('reconnecting', (attempt) => console.log(`重连中... #${attempt}`));
    plc.on('error', (err) => console.error('错误:', err.message));

    await plc.connect();

    // 字的读/写
    await plc.write('DM100', 1234);
    console.log(await plc.read('DM100')); // "1234"

    // 带类型的读/写
    await plc.writeInt32('DM300', -99999);
    console.log(await plc.readInt32('DM300')); // -99999

    // 布尔/位的读/写
    await plc.writeBool('R100', true);
    console.log(await plc.readBool('R100')); // true

    await plc.disconnect();
}

main();
```

> 请参考 [`example.js`](./example.js) 获取完整的使用示例。

## 支持的数据类型后缀

基恩士 PLC 支持附加到设备名称的数据类型后缀。你可以直接传递它们：

| 后缀 | 描述 | 示例 |
|--------|-------------|---------|
| `.U` | 无符号 16 位 | `DM100.U` |
| `.S` | 有符号 16 位 | `DM100.S` |
| `.D` | 无符号 32 位 | `DM100.D` |
| `.L` | 有符号 32 位 | `DM100.L` |
| `.H` | 十六进制 16 位 | `DM100.H` |

```javascript
await plc.read('DM100.L');           // 32 位有符号
await plc.write('DM100.L', 999999);
```

## API 参考

### `new KeyencePLC(options)`

| 选项 | 类型 | 默认值 | 描述 |
|--------|------|---------|-------------|
| `host` | `string` | — | PLC IP 地址 *(必填)* |
| `port` | `number` | `8501` | PLC 端口 |
| `timeout` | `number` | `5000` | 指令超时时间 (毫秒) |
| `station` | `number` | — | 多站通信时的站号 |
| `autoReconnect` | `boolean` | `true` | 是否开启自动重连 |
| `reconnectInterval` | `number` | `3000` | 重连间隔 (毫秒) |
| `noDelay` | `boolean` | `true` | 禁用 Nagle 算法以降低延迟 |
| `keepAlive` | `boolean` | `true` | 启用 TCP keepalive |
| `keepAliveInitialDelay` | `number` | `1000` | keepalive 延迟 (毫秒) |
| `maxReadPoints` | `number` | `64` | 每个读指令的最大连续点数 |
| `maxWritePoints` | `number` | `64` | 每个写指令的最大连续点数 |
| `maxPendingCommands` | `number` | `128` | 在活动指令后排队等待的最大指令数 |

### 事件

| 事件 | 负载 (Payload) | 描述 |
|-------|---------|-------------|
| `connected` | — | 成功连接到 PLC 时触发 |
| `disconnected` | — | 从 PLC 断开连接时触发 |
| `reconnecting` | `attempt: number` | 每次尝试重连时触发 |
| `error` | `err: Error` | 发生连接错误时触发 |

### 连接方法

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | 建立 TCP 连接并初始化会话 |
| `disconnect()` | `Promise<void>` | 安全关闭连接 |
| `reconnect()` | `Promise<void>` | 强制断开并重新连接 |
| `isConnected()` | `boolean` | 检查当前的连接状态 |

### 字 (Word) 的读 / 写

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `read(device)` | `Promise<string>` | 读取单个设备数据 |
| `readMulti(device, count)` | `Promise<string[]>` | 读取多个连续设备数据 |
| `write(device, value)` | `Promise<boolean>` | 写入单个设备 |
| `writeMulti(device, values)` | `Promise<boolean>` | 写入多个连续设备 |

### 带类型的读 / 写

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `readInt16(device)` | `Promise<number>` | 读取 16 位有符号整数 |
| `readUInt16(device)` | `Promise<number>` | 读取 16 位无符号整数 |
| `readInt32(device)` | `Promise<number>` | 读取 32 位有符号整数 |
| `readUInt32(device)` | `Promise<number>` | 读取 32 位无符号整数 |
| `writeInt16(device, value)` | `Promise<boolean>` | 写入 16 位有符号整数 |
| `writeUInt16(device, value)` | `Promise<boolean>` | 写入 16 位无符号整数 |
| `writeInt32(device, value)` | `Promise<boolean>` | 写入 32 位有符号整数 |
| `writeUInt32(device, value)` | `Promise<boolean>` | 写入 32 位无符号整数 |
| `readString(device, length)` | `Promise<string>` | 从连续字中读取字符串 |
| `writeString(device, text)` | `Promise<boolean>` | 写入字符串到连续字 |

### 布尔/位 (Bit) 的读 / 写

| 方法 | 返回值 | 描述 |
|--------|---------|-------------|
| `readBool(device)` | `Promise<boolean>` | 读取单个位状态 |
| `writeBool(device, value)` | `Promise<boolean>` | 置位或复位单个位 |
| `readBoolMulti(device, count)` | `Promise<boolean[]>` | 读取多个连续位的状态 |
| `writeBoolMulti(device, values)` | `Promise<boolean>` | 连续写入多个位 |

大型的连续操作会自动使用 `maxReadPoints` 和 `maxWritePoints` 进行分块。为了减小有效载荷大小、尾部延迟并在错误发生后加快恢复时间，默认每个指令的分块大小为 `64` 个点。

## 错误处理

该库导出了用于精细错误处理的自定义错误类：

```javascript
const { KeyencePLC, KeyenceError, TimeoutError } = require('node-keyence-hostlink');

try {
    await plc.read('DM99999');
} catch (err) {
    if (err instanceof KeyenceError) {
        // PLC 返回了错误代码 (E0, E1, E2, E4, E5, E6)
        console.error(`PLC 错误 [${err.code}]:`, err.message);
        console.error(`失败的指令:`, err.command);
    } else if (err instanceof TimeoutError) {
        // 指令超时
        console.error('超时:', err.message);
    } else {
        // 连接或其他错误
        console.error('错误:', err.message);
    }
}
```

### PLC 错误代码

| 代码 | 描述 |
|------|-------------|
| `E0` | 设备号错误 |
| `E1` | 指令错误 |
| `E2` | 设备格式错误 |
| `E4` | 写保护 |
| `E5` | 程序错误 |
| `E6` | 数据错误 |

## 低延迟说明

- 每个 TCP 连接上只有一条 PLC 正在执行的指令（在途指令）。
- 如果活动指令超时，套接字将被销毁，这样较晚到达的 PLC 响应就不会匹配到错误的请求上。
- 实际的连续读写最大值仍然取决于你的 PLC 型号和设备区域。
  本库强制执行的，是在软件层面配置的分块大小，而非一种普适的协议级别的最大限制。

## 项目结构

```
src/
├── index.ts          # 公开导出
├── types.ts          # 接口和类型定义
├── errors.ts         # 自定义错误类 (KeyenceError, TimeoutError, ConnectionError)
├── connection.ts     # TCP 连接管理、重连逻辑、指令队列
├── device.ts         # 设备名称工具函数 (后缀解析)
├── operations.ts     # 字、位和带类型的读写操作
└── keyence-plc.ts    # 主要的 KeyencePLC 类 (上述模块的组合)
```

## 联系方式

- 邮箱: linnanly@gmail.com
- 微信: linnan-wx

## 许可证

MIT
