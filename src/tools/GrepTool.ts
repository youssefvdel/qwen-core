import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { BaseTool } from './BaseTool.js';

const execAsync = promisify(exec);

export class GrepTool extends BaseTool {
    name = "grep_search";
    description = "Search for text content in files using grep. Use regex patterns to find specific code, functions, or text.";

    inputSchema = z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        path: z.string().optional().describe("Directory or file to search in (defaults to current directory)"),
        glob: z.string().optional().describe("File filter glob pattern (e.g., '*.ts', '**/*.js') (optional)")
    });

    async execute({
        pattern,
        path: searchPath = '.',
        glob: globFilter
    }: {
        pattern: string;
        path?: string;
        glob?: string;
    }) {
        try {
            console.error(`🔎 Grep search: "${pattern}" in ${searchPath}`);

            const resolvedPath = path.resolve(searchPath);

            // Build grep command
            let cmd = 'grep -rn';

            // Add case-insensitive flag
            cmd += 'i';

            // Add context lines (2 before and after)
            cmd += ' -C 2';

            // Add file filter if provided
            if (globFilter) {
                cmd += ` --include="${globFilter}"`;
            }

            // Add pattern and path
            cmd += ` "${pattern}" "${resolvedPath}"`;

            // Limit output and handle errors gracefully
            cmd += ' 2>/dev/null | head -n 200';

            const { stdout, stderr } = await execAsync(cmd, {
                maxBuffer: 1024 * 1024 * 10,
                timeout: 30000 // 30 second timeout
            });

            const output = stdout.trim();

            if (!output) {
                return {
                    content: [{ type: "text", text: `No matches found for pattern: "${pattern}"` }]
                };
            }

            // Count matches
            const matchCount = output.split('\n').filter(line => line && !line.startsWith('--')).length;

            // Truncate if too large
            const maxLength = 50 * 1024; // 50KB
            const truncatedOutput = output.length > maxLength
                ? output.substring(0, maxLength) + '\n\n... [Output truncated - too many matches] ...'
                : output;

            return {
                content: [{
                    type: "text",
                    text: `[Found ~${matchCount} match(es)]\n\n${truncatedOutput}`
                }]
            };
        } catch (err: any) {
            // grep returns exit code 1 when no matches found - that's OK
            if (err.code === 1 && !err.stdout) {
                return {
                    content: [{ type: "text", text: `No matches found for pattern: "${pattern}"` }]
                };
            }

            if (err.killed) {
                return {
                    content: [{ type: "text", text: `❌ Search timed out after 30 seconds. Try a more specific pattern.` }],
                    isError: true
                };
            }

            return {
                content: [{ type: "text", text: `❌ Grep error: ${err.message}` }],
                isError: true
            };
        }
    }
}
