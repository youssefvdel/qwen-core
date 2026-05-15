import * as path from 'path';
import * as os from 'os';

/**
 * PathValidator - Enforces MCP_ALLOWED_DIRS restrictions
 * Validates that file operations stay within allowed directories
 */

let allowedDirs: string[] | null = null;

/**
 * Initialize allowed directories from environment variable
 * Called once at startup
 */
export function initAllowedDirs(): void {
 const envVar = process.env.MCP_ALLOWED_DIRS;
 
 if (!envVar) {
 // Default: home directory and /tmp
 allowedDirs = [
 os.homedir(),
 path.join(os.homedir(), 'Projects'),
 '/tmp'
 ];
 console.error(` Path validation: Using defaults (${allowedDirs.join(', ')})`);
 return;
 }
 
 allowedDirs = envVar.split(',').map(d => d.trim()).filter(d => d.length > 0);
 console.error(` Path validation: ${allowedDirs.length} allowed dir(s): ${allowedDirs.join(', ')}`);
}

/**
 * Get current allowed directories
 */
export function getAllowedDirs(): string[] {
 if (!allowedDirs) {
 initAllowedDirs();
 }
 return allowedDirs!;
}

/**
 * Check if a path is within allowed directories
 */
export function isPathAllowed(filePath: string): boolean {
 if (!allowedDirs) {
 initAllowedDirs();
 }
 
 const resolvedPath = path.resolve(filePath);
 
 return allowedDirs!.some(allowedDir => {
 const resolvedAllowed = path.resolve(allowedDir);
 return resolvedPath.startsWith(resolvedAllowed + path.sep) || resolvedPath === resolvedAllowed;
 });
}

/**
 * Validate a path and return error message if not allowed
 */
export function validatePath(filePath: string): { allowed: boolean; error?: string } {
 if (isPathAllowed(filePath)) {
 return { allowed: true };
 }
 
 const resolvedPath = path.resolve(filePath);
 return {
 allowed: false,
 error: ` Path not allowed: ${resolvedPath}\nAllowed directories: ${getAllowedDirs().join(', ')}`
 };
}

/**
 * Get a user-friendly message about path restrictions
 */
export function getPathRestrictionMessage(): string {
 return `File operations restricted to: ${getAllowedDirs().join(', ')}`;
}
