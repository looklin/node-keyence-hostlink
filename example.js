/**
 * node-keyence-hostlink Example
 *
 * This example demonstrates how to use the library to communicate
 * with a Keyence PLC via Host Link Protocol over TCP/IP.
 *
 * Usage:
 *   node example.js [host] [port]
 *
 * Example:
 *   node example.js 192.168.0.10 8501
 */

const { KeyencePLC, KeyenceError, TimeoutError } = require('node-keyence-hostlink');

const HOST = '127.0.0.1';
const PORT = parseInt(process.argv[3] || '8501', 10);

async function main() {
    // ─── 1. Initialize ──────────────────────────────────────────
    const plc = new KeyencePLC({
        host: HOST,
        port: PORT,
        timeout: 5000,
        autoReconnect: true,
        reconnectInterval: 3000,
    });

    // ─── 2. Register Event Listeners ─────────────────────────────
    plc.on('connected', () => {
        console.log('✅ PLC connected');
    });

    plc.on('disconnected', () => {
        console.log('🔌 PLC disconnected');
    });

    plc.on('reconnecting', (attempt) => {
        console.log(`🔄 Reconnecting... attempt #${attempt}`);
    });

    plc.on('error', (err) => {
        console.error('❌ Connection error:', err.message);
    });

    try {
        // ─── 3. Connect ──────────────────────────────────────────
        console.log(`Connecting to PLC at ${HOST}:${PORT}...`);
        await plc.connect();

        // ─── 4. Word Operations (DM, EM, FM, ZF, W, TM, Z, CM, VM) ──
        console.log('\n--- Word Operations ---');

        // Single word read / write
        await plc.write('DM100', 1234);
        const dm100 = await plc.read('DM100');
        console.log(`DM100 = ${dm100}`);  // "1234"

        // Multi word read / write (continuous)
        await plc.writeMulti('DM200', [10, 20, 30]);
        const dm200 = await plc.readMulti('DM200', 3);
        console.log(`DM200~DM202 =`, dm200);  // ['10', '20', '30']

        // Read with data type suffix (passed directly to PLC)
        const dm100L = await plc.readUInt32('DM100');
        console.log(`DM100.L (readUInt32) = ${dm100L}`);

        // ─── 5. Typed Operations (Int16, Int32, String) ──────────
        console.log('\n--- Typed Operations ---');

        // 16-bit Signed Integer
        await plc.writeInt16('EM400', -1234);
        const int16val = await plc.readInt16('EM400');
        console.log(`EM400 (Int16) = ${int16val}`);  // -1234

        // 16-bit Unsigned Integer
        await plc.writeUInt16('EM401', 50000);
        const uint16val = await plc.readUInt16('EM401');
        console.log(`EM401 (UInt16) = ${uint16val}`);  // 50000

        // 32-bit Signed Integer (spans 2 words)
        await plc.writeInt32('DM300', -99999);
        const int32val = await plc.readInt32('DM300');
        console.log(`DM300 (Int32) = ${int32val}`);  // -99999

        // 32-bit Unsigned Integer
        await plc.writeUInt32('DM302', 100000);
        const uint32val = await plc.readUInt32('DM302');
        console.log(`DM302 (UInt32) = ${uint32val}`);  // 100000

        // String (2 chars per word, auto spans)
        await plc.writeString('EM100', 'HELLO');
        const str = await plc.readString('EM100', 5);
        console.log(`EM100 (String) = "${str}"`);  // "HELLO"

        // ─── 6. Bit / Boolean Operations (R, B, MR, LR, CR, VB) ─
        console.log('\n--- Bit / Boolean Operations ---');

        // Single bit set / reset
        await plc.writeBool('R100', true);   // ST R100
        const r100 = await plc.readBool('R100');
        console.log(`R100 = ${r100}`);  // true

        await plc.writeBool('MR100', false); // RS MR100
        const mr100 = await plc.readBool('MR100');
        console.log(`MR100 = ${mr100}`);  // false

        // Multi bit read / write
        await plc.writeBoolMulti('B200', [true, false, true, true]);
        const bits = await plc.readBoolMulti('B200', 4);
        console.log(`B200~B203 =`, bits);  // [true, false, true, true]

        // ─── 7. Timer / Counter (Double Word Devices) ────────────
        console.log('\n--- Timer / Counter Operations ---');

        // Use writeUInt32 for native 32-bit devices (TC, CC, TS, CS)
        await plc.writeUInt32('TC10', 50000);
        const tc10 = await plc.readUInt32('TC10');
        console.log(`TC10 = ${tc10}`);  // 50000

        await plc.writeUInt32('TC20', 1000);
        await plc.writeUInt32('TC21', 2000);
        const tc20_21 = await plc.readMulti('TC20', 2);
        console.log(`TC20~TC21 =`, tc20_21);

        console.log('\n✅ All operations completed successfully!');

    } catch (err) {
        // Catch specific error types for granular handling
        if (err instanceof KeyenceError) {
            console.error(`PLC Error [${err.code}]:`, err.message);
        } else if (err instanceof TimeoutError) {
            console.error('Timeout:', err.message);
        } else {
            console.error('Error:', err.message);
        }
    } finally {
        // ─── 8. Disconnect ───────────────────────────────────────
        await plc.disconnect();
        console.log('Done.');
    }
}

main();
