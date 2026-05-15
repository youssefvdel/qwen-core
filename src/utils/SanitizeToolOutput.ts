/**
 * SanitizeToolOutput - Ensures tool responses are safe for MCP JSON-RPC transport
 * Strips control characters, null bytes, and other problematic characters
 * that could crash the MCP protocol when sent to Qwen chat.
 */

/**
 * Sanitize a string for safe MCP transport
 * Removes:
 * - Null bytes (\x00)
 * - Control characters (\x01-\x1F) except \n, \r, \t
 * - Unicode replacement characters
 * - BOM markers
 * - Zero-width spaces
 * - Non-breaking spaces (convert to regular spaces)
 */
export function sanitizeOutput(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    // Remove null bytes
    .replace(/\x00/g, '')
    // Remove control characters except \n, \r, \t
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Remove BOM
    .replace(/\uFEFF/g, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\u2060]/g, '')
    // Convert non-breaking spaces to regular spaces
    .replace(/\u00A0/g, ' ')
    // Remove Unicode replacement character
    .replace(/\uFFFD/g, '')
    // Limit output size (max 500KB)
    .slice(0, 500 * 1024);
}

/**
 * Sanitize error messages (more aggressive stripping)
 */
export function sanitizeError(text: string): string {
  return sanitizeOutput(text)
    // Remove any remaining non-printable characters
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    // Truncate error messages
    .slice(0, 10000);
}
