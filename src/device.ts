/**
 * Utility functions for parsing and validating Keyence PLC device names.
 */

/** Valid data type suffixes for device names. */
const SUFFIX_REGEX = /\.[USDLH]$/i;

/** Native 32-bit device prefixes in newer KV series. */
const NATIVE_32BIT_PREFIXES = ['TC', 'CC', 'TS', 'CS', 'Z'];

/**
 * Strip the data-type suffix from a device name.
 * E.g., "DM100.L" -> "DM100", "DM100" -> "DM100"
 */
export function stripSuffix(device: string): string {
    return device.replace(SUFFIX_REGEX, '');
}

/**
 * Check if a device is a native 32-bit device (like TC, CC, TS, CS, Z).
 */
export function isNative32Bit(device: string): boolean {
    const stripped = stripSuffix(device).toUpperCase();
    return NATIVE_32BIT_PREFIXES.some(prefix => stripped.startsWith(prefix));
}
