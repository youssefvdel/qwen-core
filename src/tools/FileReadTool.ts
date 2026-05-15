import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './BaseTool.js';

export class FileReadTool extends BaseTool {
    name = "file_read";
    description = "Read the contents of a file on disk. Supports text files, images, and other formats.";

    inputSchema = z.object({
        path: z.string().describe("Absolute or relative file path to read")
    });

    async execute({ path: filePath }: { path: string }) {
        try {
            // Validate path is within allowed directories
            const pathValidation = this.validateFilePath(filePath);
            if (!pathValidation.valid) {
                return {
                    content: [{ type: "text", text: pathValidation.error! }],
                    isError: true
                };
            }

            // Resolve to absolute path
            const resolvedPath = path.resolve(filePath);

            console.error(`📖 Reading file: ${resolvedPath}`);

            // Check if file exists
            try {
                await fs.access(resolvedPath);
            } catch {
                return {
                    content: [{ type: "text", text: `❌ File not found: ${resolvedPath}` }],
                    isError: true
                };
            }

            // Get file stats
            const stats = await fs.stat(resolvedPath);

            // Prevent reading very large files (>10MB)
            const maxSize = 10 * 1024 * 1024;
            if (stats.size > maxSize) {
                return {
                    content: [{ type: "text", text: `❌ File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 10MB.` }],
                    isError: true
                };
            }

            // Read file as UTF-8 text
            const content = await fs.readFile(resolvedPath, 'utf-8');

            // Dynamic timeout based on content size
            const timeout = this.getTimeout('file_read', { contentSize: stats.size });
            const timeoutSeconds = (timeout / 1000).toFixed(1);

            // Add line numbers for easier reference
            const lines = content.split('\n');
            const numberedContent = lines.map((line, i) => `${i + 1}\t${line}`).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `[File: ${resolvedPath}]\n[Lines: ${lines.length}]\n[Timeout: ${timeoutSeconds}s]\n\n${numberedContent}`
                }]
            };
        } catch (err: any) {
            if (err.code === 'EISDIR') {
                return {
                    content: [{ type: "text", text: `❌ Path is a directory, not a file: ${filePath}` }],
                    isError: true
                };
            }

            return {
                content: [{ type: "text", text: `❌ File read error: ${err.message}` }],
                isError: true
            };
        }
    }
}
