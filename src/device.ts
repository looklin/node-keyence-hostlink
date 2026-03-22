/**
 * 用于解析和验证基恩士 PLC 设备名称的工具函数。
 */

/** 设备名称可用的有效数据类型后缀。 */
const SUFFIX_REGEX = /\.[USDLH]$/i;

/** 较新 KV 系列中原生的 32 位设备前缀。 */
const NATIVE_32BIT_PREFIXES = ['TC', 'CC', 'TS', 'CS', 'Z'];
const HEX_DEVICE_PREFIXES = ['B', 'W'];
const DEVICE_REGEX = /^([A-Za-z]+)([0-9A-Fa-f]+)(\.[A-Za-z])?$/;

/**
 * 去除设备名称的数据类型后缀。
 * 例如："DM100.L" -> "DM100", "DM100" -> "DM100"
 */
export function stripSuffix(device: string): string {
    return device.replace(SUFFIX_REGEX, '');
}

/**
 * 检查设备是否是原生的 32 位设备（如 TC, CC, TS, CS, Z）。
 */
export function isNative32Bit(device: string): boolean {
    const stripped = stripSuffix(device).toUpperCase();
    return NATIVE_32BIT_PREFIXES.some(prefix => stripped.startsWith(prefix));
}

/**
 * 递增连续设备地址，同时保留后缀。
 * 例如："DM100.H" + 10 => "DM110.H", "W0A" + 1 => "W0B"
 */
export function incrementDevice(device: string, offset: number): string {
    if (!Number.isInteger(offset) || offset < 0) {
        throw new RangeError(`无效的设备偏移量: ${offset}`);
    }

    if (offset === 0) {
        return device;
    }

    const match = device.match(DEVICE_REGEX);
    if (!match) {
        throw new Error(`不支持的设备格式，无法进行自动分块: ${device}`);
    }

    const [, prefix, rawAddress, suffix = ''] = match;
    const upperPrefix = prefix.toUpperCase();
    const radix = HEX_DEVICE_PREFIXES.includes(upperPrefix) ? 16 : 10;
    const address = parseInt(rawAddress, radix);

    if (Number.isNaN(address)) {
        throw new Error(`无效的设备地址: ${device}`);
    }

    const nextAddress = address + offset;
    const nextRawAddress = radix === 16
        ? nextAddress.toString(16).toUpperCase().padStart(rawAddress.length, '0')
        : nextAddress.toString(10).padStart(rawAddress.length, '0');

    return `${prefix}${nextRawAddress}${suffix}`;
}
