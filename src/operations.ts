import { Connection } from './connection';
import { stripSuffix } from './device';

/**
 * Word (16-bit register) read/write operations.
 * Operates on devices like DM, EM, FM, ZF, W, TM, Z, CM, VM.
 */
export class WordOperations {
    constructor(private readonly conn: Connection) { }

    /** Read a single device value as a string. */
    async read(device: string): Promise<string> {
        return await this.conn.sendCommand(`RD ${device}`);
    }

    /** Read multiple consecutive device values. */
    async readMulti(device: string, count: number): Promise<string[]> {
        const res = await this.conn.sendCommand(`RDS ${device} ${count}`);
        return res.split(' ').filter(v => v !== '');
    }

    /** Write a value to a single device. */
    async write(device: string, value: string | number): Promise<boolean> {
        const res = await this.conn.sendCommand(`WR ${device} ${value}`);
        return res === 'OK';
    }

    /** Write multiple values to consecutive devices. */
    async writeMulti(device: string, values: (string | number)[]): Promise<boolean> {
        const res = await this.conn.sendCommand(
            `WRS ${device} ${values.length} ${values.join(' ')}`
        );
        return res === 'OK';
    }
}

/**
 * Bit (boolean) device read/write operations.
 * Operates on devices like R, B, MR, LR, CR, VB.
 */
export class BitOperations {
    constructor(private readonly conn: Connection) { }

    /** Read a single boolean (bit) value. */
    async readBool(device: string): Promise<boolean> {
        const res = await this.conn.sendCommand(`RD ${device}`);
        return res === '1';
    }

    /** Read multiple consecutive boolean (bit) values. */
    async readBoolMulti(device: string, count: number): Promise<boolean[]> {
        const res = await this.conn.sendCommand(`RDS ${device} ${count}`);
        return res.split(' ').filter(v => v !== '').map(v => v === '1');
    }

    /** Write a single boolean (bit) value using ST/RS commands. */
    async writeBool(device: string, value: boolean): Promise<boolean> {
        const cmd = value ? 'ST' : 'RS';
        const res = await this.conn.sendCommand(`${cmd} ${device}`);
        return res === 'OK';
    }

    /** Write multiple consecutive boolean (bit) values. */
    async writeBoolMulti(device: string, values: boolean[]): Promise<boolean> {
        const strValues = values.map(v => v ? '1' : '0').join(' ');
        const res = await this.conn.sendCommand(
            `WRS ${device} ${values.length} ${strValues}`
        );
        return res === 'OK';
    }
}

/**
 * Typed read/write operations for Int16, UInt16, Int32, UInt32, and String.
 * These helpers handle Buffer conversion and multi-word spanning.
 */
export class TypedOperations {
    constructor(private readonly word: WordOperations) { }

    // ─── 16-bit ──────────────────────────────────────────────────

    /** Read a 16-bit Unsigned Integer. */
    async readUInt16(device: string): Promise<number> {
        const res = await this.word.read(device);
        return parseInt(res, 10);
    }

    /** Read a 16-bit Signed Integer. */
    async readInt16(device: string): Promise<number> {
        const raw = await this.readUInt16(device);
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(raw);
        return buf.readInt16LE(0);
    }

    /** Write a 16-bit Unsigned Integer. */
    async writeUInt16(device: string, value: number): Promise<boolean> {
        return await this.word.write(device, value);
    }

    /** Write a 16-bit Signed Integer. */
    async writeInt16(device: string, value: number): Promise<boolean> {
        const buf = Buffer.alloc(2);
        buf.writeInt16LE(value);
        return await this.word.write(device, buf.readUInt16LE(0));
    }

    // ─── 32-bit ──────────────────────────────────────────────────

    /** Read a 32-bit Unsigned Integer (Double Word). */
    async readUInt32(device: string): Promise<number> {
        const words = await this.word.readMulti(device, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16LE(parseInt(words[0], 10), 0);
        buf.writeUInt16LE(parseInt(words[1], 10), 2);
        return buf.readUInt32LE(0);
    }

    /** Read a 32-bit Signed Integer (Double Word). */
    async readInt32(device: string): Promise<number> {
        const words = await this.word.readMulti(device, 2);
        const buf = Buffer.alloc(4);
        buf.writeUInt16LE(parseInt(words[0], 10), 0);
        buf.writeUInt16LE(parseInt(words[1], 10), 2);
        return buf.readInt32LE(0);
    }

    /** Write a 32-bit Unsigned Integer (Double Word). */
    async writeUInt32(device: string, value: number): Promise<boolean> {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(value);
        return await this.word.writeMulti(device, [buf.readUInt16LE(0), buf.readUInt16LE(2)]);
    }

    /** Write a 32-bit Signed Integer (Double Word). */
    async writeInt32(device: string, value: number): Promise<boolean> {
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value);
        return await this.word.writeMulti(device, [buf.readUInt16LE(0), buf.readUInt16LE(2)]);
    }

    // ─── String ──────────────────────────────────────────────────

    /** Read a string from consecutive word devices. */
    async readString(device: string, length: number): Promise<string> {
        const wordCount = Math.ceil(length / 2);
        const words = await this.word.readMulti(device, wordCount);

        const buf = Buffer.alloc(wordCount * 2);
        for (let i = 0; i < words.length; i++) {
            buf.writeUInt16LE(parseInt(words[i], 10), i * 2);
        }

        return buf.toString('ascii', 0, length).replace(/\0/g, '');
    }

    /** Write a string to consecutive word devices. */
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
