/**
 * node-keyence-hostlink 示例
 *
 * 此示例展示了如何使用该库通过 TCP/IP 上的
 * Host Link Protocol (上位链路协议) 与基恩士 PLC 通信。
 *
 * 用法:
 *   node example.js [host] [port]
 *
 * 示例:
 *   node example.js 192.168.0.10 8501
 */

const { KeyencePLC, KeyenceError, TimeoutError } = require('node-keyence-hostlink');

const HOST = process.argv[2] || '127.0.0.1';
const PORT = parseInt(process.argv[3] || '8501', 10);

async function main() {
    // ─── 1. 初始化 ──────────────────────────────────────────
    const plc = new KeyencePLC({
        host: HOST,
        port: PORT,
        timeout: 5000,
        autoReconnect: true,
        reconnectInterval: 3000,
    });

    // ─── 2. 注册事件监听器 ─────────────────────────────
    plc.on('connected', () => {
        console.log('✅ PLC 已连接');
    });

    plc.on('disconnected', () => {
        console.log('🔌 PLC 已断开连接');
    });

    plc.on('reconnecting', (attempt) => {
        console.log(`🔄 重连中... 第 #${attempt} 次尝试`);
    });

    plc.on('error', (err) => {
        console.error('❌ 连接错误:', err.message);
    });

    try {
        // ─── 3. 连接 ──────────────────────────────────────────
        console.log(`正在连接到 PLC ${HOST}:${PORT}...`);
        await plc.connect();

        // ─── 4. 字操作 (DM, EM, FM, ZF, W, TM, Z, CM, VM) ──
        console.log('\n--- 字操作 ---');

        // 单字读 / 写
        await plc.write('DM100', 1234);
        const dm100 = await plc.read('DM100');
        console.log(`DM100 = ${dm100}`);  // "1234"

        // 多字读 / 写 (连续)
        await plc.writeMulti('DM200', [10, 20, 30]);
        const dm200 = await plc.readMulti('DM200', 3);
        console.log(`DM200~DM202 =`, dm200);  // ['10', '20', '30']

        // 使用数据类型后缀读取 (直接传递给 PLC)
        const dm100L = await plc.readUInt32('DM100');
        console.log(`DM100.L (readUInt32) = ${dm100L}`);

        // ─── 5. 带类型的操作 (Int16, Int32, String) ──────────
        console.log('\n--- 带类型的操作 ---');

        // 16位有符号整数
        await plc.writeInt16('EM400', -1234);
        const int16val = await plc.readInt16('EM400');
        console.log(`EM400 (Int16) = ${int16val}`);  // -1234

        // 16位无符号整数
        await plc.writeUInt16('EM401', 50000);
        const uint16val = await plc.readUInt16('EM401');
        console.log(`EM401 (UInt16) = ${uint16val}`);  // 50000

        // 32位有符号整数 (跨越两个字)
        await plc.writeInt32('DM300', -99999);
        const int32val = await plc.readInt32('DM300');
        console.log(`DM300 (Int32) = ${int32val}`);  // -99999

        // 32位无符号整数
        await plc.writeUInt32('DM302', 100000);
        const uint32val = await plc.readUInt32('DM302');
        console.log(`DM302 (UInt32) = ${uint32val}`);  // 100000

        // 字符串 (每个字2个字符，自动跨字)
        await plc.writeString('EM100', 'HELLO');
        const str = await plc.readString('EM100', 5);
        console.log(`EM100 (String) = "${str}"`);  // "HELLO"

        // ─── 6. 位 / 布尔操作 (R, B, MR, LR, CR, VB) ─
        console.log('\n--- 位 / 布尔操作 ---');

        // 单个位置位 / 复位
        await plc.writeBool('R100', true);   // ST R100
        const r100 = await plc.readBool('R100');
        console.log(`R100 = ${r100}`);  // true

        await plc.writeBool('MR100', false); // RS MR100
        const mr100 = await plc.readBool('MR100');
        console.log(`MR100 = ${mr100}`);  // false

        // 多个位读 / 写
        await plc.writeBoolMulti('B200', [true, false, true, true]);
        const bits = await plc.readBoolMulti('B200', 4);
        console.log(`B200~B203 =`, bits);  // [true, false, true, true]

        // ─── 7. 定时器 / 计数器 (双字设备) ────────────
        console.log('\n--- 定时器 / 计数器操作 ---');

        // 对原生的 32 位设备 (TC, CC, TS, CS) 使用 writeUInt32
        await plc.writeUInt32('TC10', 50000);
        const tc10 = await plc.readUInt32('TC10');
        console.log(`TC10 = ${tc10}`);  // 50000

        await plc.writeUInt32('TC20', 1000);
        await plc.writeUInt32('TC21', 2000);
        const tc20_21 = await plc.readMulti('TC20', 2);
        console.log(`TC20~TC21 =`, tc20_21);

        console.log('\n✅ 所有操作均已成功完成！');

    } catch (err) {
        // 捕获特定类型的错误以进行精细处理
        if (err instanceof KeyenceError) {
            console.error(`PLC 错误 [${err.code}]:`, err.message);
        } else if (err instanceof TimeoutError) {
            console.error('超时:', err.message);
        } else {
            console.error('错误:', err.message);
        }
    } finally {
        // ─── 8. 断开连接 ───────────────────────────────────────
        await plc.disconnect();
        console.log('完成。');
    }
}

main();
