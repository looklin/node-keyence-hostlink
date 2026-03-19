/**
 * Utility functions for parsing and validating Keyence PLC device names.
 */

/** Valid data type suffixes for device names. */
const SUFFIX_REGEX = /\.[USDLH]$/i;

/**
 * Strip the data-type suffix from a device name.
 * E.g., "DM100.L" -> "DM100", "DM100" -> "DM100"
 */
export function stripSuffix(device: string): string {
    return device.replace(SUFFIX_REGEX, '');
}
