/**
 * TimeoutEstimator - Dynamic timeout calculation per operation
 * Estimates appropriate timeout based on operation type, size, and complexity
 */

export type OperationType = 
 | 'file_read'
 | 'file_write'
 | 'file_edit'
 | 'bash_command'
 | 'grep_search'
 | 'glob_search'
 | 'web_fetch'
 | 'git_operation'
 | 'process_list'
 | 'sequential_thinking';

export interface TimeoutOptions {
 /** Content size in bytes (for file operations) */
 contentSize?: number;
 /** Command type (for bash operations) */
 commandType?: 'quick' | 'build' | 'install' | 'test' | 'git' | 'unknown';
 /** Search depth (for grep/glob) */
 searchDepth?: 'shallow' | 'deep' | 'recursive';
 /** URL type (for web fetch) */
 urlType?: 'api' | 'page' | 'large_page';
}

/**
 * Base timeouts for each operation type (in milliseconds)
 */
const BASE_TIMEOUTS: Record<OperationType, number> = {
 file_read: 5000,
 file_write: 5000,
 file_edit: 5000,
 bash_command: 15000,
 grep_search: 15000,
 glob_search: 10000,
 web_fetch: 15000,
 git_operation: 20000,
 process_list: 5000,
 sequential_thinking: 30000,
};

/**
 * Multipliers for different factors
 */
const MULTIPLIERS = {
 // Content size multipliers
 contentSize: {
 small: 1, // < 10KB
 medium: 1.5, // 10KB - 100KB
 large: 2, // 100KB - 1MB
 xlarge: 3, // > 1MB
 },
 // Search depth multipliers
 searchDepth: {
 shallow: 1,
 deep: 2,
 recursive: 3,
 },
 // Command type multipliers
 commandType: {
 quick: 0.5, // ls, cat, echo
 build: 3, // npm run build, make
 install: 4, // npm install, pip install
 test: 2, // npm test, pytest
 git: 1.5, // git operations
 unknown: 1,
 },
 // URL type multipliers
 urlType: {
 api: 1,
 page: 1.5,
 large_page: 3,
 },
};

/**
 * Classify content size
 */
function classifyContentSize(bytes: number): 'small' | 'medium' | 'large' | 'xlarge' {
 if (bytes < 10 * 1024) return 'small';
 if (bytes < 100 * 1024) return 'medium';
 if (bytes < 1024 * 1024) return 'large';
 return 'xlarge';
}

/**
 * Classify bash command type
 */
function classifyCommand(cmd: string): 'quick' | 'build' | 'install' | 'test' | 'git' | 'unknown' {
 const lower = cmd.toLowerCase();
 
 if (lower.includes('npm install') || lower.includes('yarn install') || lower.includes('pip install')) {
 return 'install';
 }
 if (lower.includes('npm run build') || lower.includes('make') || lower.includes('webpack') || lower.includes('tsc')) {
 return 'build';
 }
 if (lower.includes('npm test') || lower.includes('jest') || lower.includes('pytest') || lower.includes('vitest')) {
 return 'test';
 }
 if (lower.startsWith('git ')) {
 return 'git';
 }
 if (lower.startsWith('ls') || lower.startsWith('cat') || lower.startsWith('echo') || lower.startsWith('pwd')) {
 return 'quick';
 }
 
 return 'unknown';
}

/**
 * Estimate timeout for an operation
 */
export function estimateTimeout(
 operationType: OperationType,
 options: TimeoutOptions = {}
): number {
 let timeout = BASE_TIMEOUTS[operationType];
 
 // Apply content size multiplier
 if (options.contentSize !== undefined) {
 const sizeClass = classifyContentSize(options.contentSize);
 timeout *= MULTIPLIERS.contentSize[sizeClass];
 }
 
 // Apply search depth multiplier
 if (options.searchDepth) {
 timeout *= MULTIPLIERS.searchDepth[options.searchDepth];
 }
 
 // Apply command type multiplier
 if (options.commandType) {
 timeout *= MULTIPLIERS.commandType[options.commandType];
 } else if (operationType === 'bash_command' && options.commandType === undefined) {
 // Auto-classify if command provided via options
 // (This would need the actual command string, handled in BashTool)
 }
 
 // Apply URL type multiplier
 if (options.urlType) {
 timeout *= MULTIPLIERS.urlType[options.urlType];
 }
 
 // Apply MCP_TIMEOUT env var as global cap
 const globalTimeout = parseInt(process.env.MCP_TIMEOUT || '60000', 10);
 timeout = Math.min(timeout, globalTimeout);
 
 // Minimum timeout: 3 seconds
 timeout = Math.max(timeout, 3000);
 
 return Math.round(timeout);
}

/**
 * Estimate timeout for bash command (with auto-classification)
 */
export function estimateBashTimeout(command: string): number {
 const cmdType = classifyCommand(command);
 return estimateTimeout('bash_command', { commandType: cmdType });
}

/**
 * Get timeout description for logging
 */
export function getTimeoutDescription(
 operationType: OperationType,
 options: TimeoutOptions = {}
): string {
 const timeout = estimateTimeout(operationType, options);
 const seconds = (timeout / 1000).toFixed(1);
 return `${seconds}s timeout for ${operationType}`;
}
