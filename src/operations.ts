import { Connection } from './connection';
import { incrementDevice, isNative32Bit } from './device';

function assertPositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`${name} 必须是正整数`);
    }
}

function assertNonEmpty<T>(items: T[], name: string): void {
    if (items.length === 0) {
        throw new RangeError(`${name} 不能为空`);
    }
}

/**
 * 字 (16 位寄存器) 读/写操作。
 * 针对 DM, EM, FM, ZF, W, TM, Z, CM, VM 等设备操作。
 */
export class WordOperations {
    constructor(
        private readonly conn: Connection,
        private readonly maxReadPoints: number,
        private readonly maxWritePoints: number,
    ) {
        assertPositiveInteger(maxReadPoints, 'maxReadPoints');
        assertPositiveInteger(maxWritePoints, 'maxWritePoints');
    }

    /** 读取单个设备值并作为字符串返回。 */
    async read(device: string): Promise<string> {
        return await this.conn.sendCommand(`RD ${device}`);
    }

    /** 读取多个连续设备的值。 */
    async readMulti(device: string, count: number): Promise<string[]> {
        assertPositiveInteger(count, 'count');

        const values: string[] = [];
        for (let offset = 0; offset < count; offset += this.maxReadPoints) {
            const chunkCount = Math.min(this.maxReadPoints, count - offset);
            const chunkDevice = incrementDevice(device, offset);
            const res = await this.conn.sendCommand(`RDS ${chunkDevice} ${chunkCount}`);
            values.push(...res.split(' ').filter(v => v !== ''));
        }

        return values;
    }

    /** 向单个设备写入一个值。 */
    async write(device: string, value: string | number): Promise<boolean> {
        const cmd = isNative32Bit(device) ? 'WRS' : 'WR';
        const arg = isNative32Bit(device) ? '1 ' : '';
        const res = await this.conn.sendCommand(`${cmd} ${device} ${arg}${value}`);
        return res === 'OK';
    }

    /** 向连续的设备写入多个值。 */
    async writeMulti(device: string, values: (string | number)[]): Promise<boolean> {
        assertNonEmpty(values, 'values');

        for (let offset = 0; offset < values.length; offset += this.maxWritePoints) {
            const chunkValues = values.slice(offset, offset + this.maxWritePoints);
            const chunkDevice = incrementDevice(device, offset);
            const res = await this.conn.sendCommand(
                `WRS ${chunkDevice} ${chunkValues.length} ${chunkValues.join(' ')}`
            );
            if (res !== 'OK') {
                return false;
            }
        }

        return true;
    }
}

/**
 * 位 (布尔) 设备读/写操作。
 * 针对 R, B, MR, LR, CR, VB 等设备操作。
 */
export class BitOperations {
    constructor(
        private readonly conn: Connection,
        private readonly maxReadPoints: number,
        private readonly maxWritePoints: number,
    ) {
        assertPositiveInteger(maxReadPoints, 'maxReadPoints');
        assertPositiveInteger(maxWritePoints, 'maxWritePoints');
    }

    /** 读取单个布尔 (位) 值。 */
    async readBool(device: string): Promise<boolean> {
        const res = await this.conn.sendCommand(`RD ${device}`);
        return res === '1';
    }

    /** 读取多个连续的布尔 (位) 值。 */
    async readBoolMulti(device: string, count: number): Promise<boolean[]> {
        assertPositiveInteger(count, 'count');

        const values: boolean[] = [];
        for (let offset = 0; offset < count; offset += this.maxReadPoints) {
            const chunkCount = Math.min(this.maxReadPoints, count - offset);
            const chunkDevice = incrementDevice(device, offset);
            const res = await this.conn.sendCommand(`RDS ${chunkDevice} ${chunkCount}`);
            values.push(...res.split(' ').filter(v => v !== '').map(v => v === '1'));
        }

        return values;
    }

    /** 使用 ST/RS 指令写入单个布尔 (位) 值。 */
    async writeBool(device: string, value: boolean): Promise<boolean> {
        const cmd = value ? 'ST' : 'RS';
        const res = await this.conn.sendCommand(`${cmd} ${device}`);
        return res === 'OK';
    }

    /** 连续写入多个布尔 (位) 值。 */
    async writeBoolMulti(device: string, values: boolean[]): Promise<boolean> {
        assertNonEmpty(values, 'values');

        for (let offset = 0; offset < values.length; offset += this.maxWritePoints) {
            const chunkValues = values.slice(offset, offset + this.maxWritePoints);
            const chunkDevice = incrementDevice(device, offset);
            const strValues = chunkValues.map(v => v ? '1' : '0').join(' ');
            const res = await this.conn.sendCommand(
                `WRS ${chunkDevice} ${chunkValues.length} ${strValues}`
            );
            if (res !== 'OK') {
                return false;
            }
        }

        return true;
    }
}

/**
 * 针对 Int16, UInt16, Int32, UInt32 和 String 提供的带类型读写操作。
 * 这些工具函数负责处理 Buffer 转换和跨字逻辑。
 */
export class TypedOperations {
    constructor(private readonly word: WordOperations) { }

    // ─── 16 位 ──────────────────────────────────────────────────

    /** 读取 16 位无符号整数。 */
    async readUInt16(device: string): Promise<number> {
        const res = await this.word.read(device);
        return parseInt(res, 10);
    }

    /** 读取 16 位有符号整数。 */
    async readInt16(device: string): Promise<number> {
        const raw = await this.readUInt16(device);
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(raw);
        return buf.readInt16LE(0);
    }

    /** 写入 16 位无符号整数。 */
    async writeUInt16(device: string, value: number): Promise<boolean> {
        return await this.word.write(device, value);
    }

    /** 写入 16 位有符号整数。 */
    async writeInt16(device: string, value: number): Promise<boolean> {
        const buf = Buffer.alloc(2);
        buf.writeInt16LE(value);
        return await this.word.write(device, buf.readUInt16LE(0));
    }

    // ─── 32 位 ──────────────────────────────────────────────────

    /** 读取 32 位无符号整数 (双字)。 */
    async readUInt32(device: string): Promise<number> {
        if (isNative32Bit(device)) {
            const res = await this.word.read(device);
            return parseInt(res, 10);
        }
        const words = await this.word.readMulti(device, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16LE(parseInt(words[0], 10), 0);
        buf.writeUInt16LE(parseInt(words[1], 10), 2);
        return buf.readUInt32LE(0);
    }

    /** 读取 32 位有符号整数 (双字)。 */
    async readInt32(device: string): Promise<number> {
        if (isNative32Bit(device)) {
            const raw = await this.readUInt32(device);
            const buf = Buffer.alloc(4);
            buf.writeUInt32LE(raw);
            return buf.readInt32LE(0);
        }
        const words = await this.word.readMulti(device, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16LE(parseInt(words[0], 10), 0);
        buf.writeUInt16LE(parseInt(words[1], 10), 2);
        return buf.readInt32LE(0);
    }

    /** 写入 32 位无符号整数 (双字)。 */
    async writeUInt32(device: string, value: number): Promise<boolean> {
        if (isNative32Bit(device)) {
            return await this.word.write(device, value);
        }
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(value);
        return await this.word.writeMulti(device, [buf.readUInt16LE(0), buf.readUInt16LE(2)]);
    }

    /** 写入 32 位有符号整数 (双字)。 */
    async writeInt32(device: string, value: number): Promise<boolean> {
        if (isNative32Bit(device)) {
            const buf = Buffer.alloc(4);
            buf.writeInt32LE(value);
            return await this.word.write(device, buf.readUInt32LE(0));
        }
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value);
        return await this.word.writeMulti(device, [buf.readUInt16LE(0), buf.readUInt16LE(2)]);
    }

    // ─── 字符串 ──────────────────────────────────────────────────

    /** 从连续字设备中读取字符串。 */
    async readString(device: string, length: number): Promise<string> {
        const wordCount = Math.ceil(length / 2);
        const words = await this.word.readMulti(device, wordCount);

        const buf = Buffer.alloc(wordCount * 2);
        for (let i = 0; i < words.length; i++) {
            buf.writeUInt16LE(parseInt(words[i], 10), i * 2);
        }

        return buf.toString('ascii', 0, length).replace(/\0/g, '');
    }

    /** 将字符串写入连续字设备。 */
    async writeString(device: string, text: string): Promise<boolean> {
        const wordCount = Math.ceil(text.length / 2);
        const buf = Buffer.alloc(wordCount * 2, 0);
        buf.write(text, 'ascii');

        const values: number[] = [];
        for (let i = 0; i < wordCount; i++) {
            values.push(buf.readUInt16LE(i * 2));
        }

        return await this.word.writeMulti(device, values);
    }
}
