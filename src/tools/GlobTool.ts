import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './BaseTool.js';
import { estimateTimeout } from '../utils/TimeoutEstimator.js';

export class GlobTool extends BaseTool {
    name = "glob_search";
    description = "Find files matching a glob pattern. Use to locate files by name or extension (e.g., '**/*.ts', 'src/**/*.tsx').";

    inputSchema = z.object({
        pattern: z.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.js')"),
        path: z.string().optional().describe("Base directory to search in (defaults to current directory)")
    });

    async execute({ pattern, path: searchPath = process.cwd() }: { pattern: string; path?: string }) {
        try {
            // Validate path is within allowed directories
            const pathValidation = this.validateFilePath(searchPath);
            if (!pathValidation.valid) {
                return {
                    content: [{ type: "text", text: pathValidation.error! }],
                    isError: true
                };
            }

            console.error(`🔍 Glob search: ${pattern} in ${searchPath}`);

            const resolvedPath = path.resolve(searchPath);

            // Check if directory exists
            try {
                await fs.access(resolvedPath);
            } catch {
                return {
                    content: [{ type: "text", text: `❌ Directory not found: ${resolvedPath}` }],
                    isError: true
                };
            }

            const results: string[] = [];
            const maxResults = 100;

            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/\*\*/g, '__DOUBLESTAR__')
                .replace(/\*/g, '[^/]*')
                .replace(/__DOUBLESTAR__/g, '.*')
                .replace(/\?/g, '[^/]');

            const regex = new RegExp(regexPattern + '$');

            // Determine search depth
            const isRecursive = pattern.includes('**');
            const searchDepth = isRecursive ? 'recursive' : 'shallow';

            // Dynamic timeout based on search depth
            const timeout = estimateTimeout('glob_search', { searchDepth });
            const timeoutSeconds = (timeout / 1000).toFixed(1);

            console.error(`   Timeout: ${timeoutSeconds}s`);

            // Recursive search function
            const search = async (dir: string, depth: number = 0) => {
                // Limit recursion depth
                if (depth > 10) return;

                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });

                    for (const entry of entries) {
                        // Skip hidden directories and node_modules (unless explicitly requested)
                        if (entry.name.startsWith('.') && !pattern.includes('.')) continue;
                        if (entry.name === 'node_modules' && !pattern.includes('node_modules')) continue;

                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory()) {
                            await search(fullPath, depth + 1);
                        } else if (regex.test(entry.name) || regex.test(path.relative(resolvedPath, fullPath))) {
                            results.push(fullPath);

                            // Stop if we have enough results
                            if (results.length >= maxResults) return;
                        }
                    }
                } catch (err) {
                    // Skip directories we can't read
                }
            };

            await search(resolvedPath);

            // Format results
            if (results.length === 0) {
                return {
                    content: [{ type: "text", text: `No files found matching pattern: ${pattern}` }]
                };
            }

            const relativePaths = results.map(r => path.relative(process.cwd(), r));
            const truncated = results.length > maxResults
                ? `\n... (${results.length - maxResults} more results, showing first ${maxResults})`
                : '';

            return {
                content: [{
                    type: "text",
                    text: `[Found ${results.length} file(s) | Timeout: ${timeoutSeconds}s]\n\n${relativePaths.slice(0, maxResults).join('\n')}${truncated}`
                }]
            };
        } catch (err: any) {
            return {
                content: [{ type: "text", text: `❌ Search error: ${err.message}` }],
                isError: true
            };
        }
    }
}
