import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './BaseTool.js';

export class FileEditTool extends BaseTool {
    name = "file_edit";
    description = "Perform a search-and-replace edit on an existing file. Requires exact match of oldText. Use for surgical changes to existing code.";

    inputSchema = z.object({
        path: z.string().describe("File path to edit"),
        oldText: z.string().describe("Exact text to search for (must match exactly including whitespace)"),
        newText: z.string().describe("Text to replace with")
    });

    async execute({ path: filePath, oldText, newText }: { path: string; oldText: string; newText: string }) {
        try {
            // Resolve to absolute path
            const resolvedPath = path.resolve(filePath);

            console.error(`✏️ Editing file: ${resolvedPath}`);

            // Check if file exists
            try {
                await fs.access(resolvedPath);
            } catch {
                return {
                    content: [{ type: "text", text: `❌ File not found: ${resolvedPath}` }],
                    isError: true
                };
            }

            // Read current content
            const content = await fs.readFile(resolvedPath, 'utf-8');

            // Check if oldText exists
            if (!content.includes(oldText)) {
                // Try to provide helpful context
                const lines = content.split('\n');
                const oldTextLines = oldText.split('\n');

                // Find similar lines
                let similarLine = '';
                for (const line of oldTextLines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.length > 10) {
                        const found = lines.find(l => l.includes(trimmedLine));
                        if (found) {
                            similarLine = found;
                            break;
                        }
                    }
                }

                let errorMsg = `❌ Exact match not found for oldText`;
                if (similarLine) {
                    errorMsg += `\n\n💡 Hint: Found similar line: "${similarLine.substring(0, 100)}"`;
                }
                errorMsg += `\n\nMake sure your oldText matches exactly, including:\n- Whitespace and indentation\n- Line breaks\n- Special characters`;

                return {
                    content: [{ type: "text", text: errorMsg }],
                    isError: true
                };
            }

            // Count occurrences
            const occurrences = content.split(oldText).length - 1;
            if (occurrences > 1) {
                return {
                    content: [{
                        type: "text",
                        text: `⚠️ Warning: oldText appears ${occurrences} times in the file.\nPlease make oldText more specific to target only one location.`
                    }],
                    isError: true
                };
            }

            // Perform replacement
            const updated = content.replace(oldText, newText);

            // Write back
            await fs.writeFile(resolvedPath, updated, 'utf-8');

            // Calculate diff stats
            const addedLines = newText.split('\n').length;
            const removedLines = oldText.split('\n').length;
            const netChange = addedLines - removedLines;

            return {
                content: [{
                    type: "text",
                    text: `✅ File edited successfully\nPath: ${resolvedPath}\nChanges: +${addedLines} lines, -${removedLines} lines (${netChange >= 0 ? '+' : ''}${netChange} net)`
                }]
            };
        } catch (err: any) {
            return {
                content: [{ type: "text", text: `❌ Edit error: ${err.message}` }],
                isError: true
            };
        }
    }
}
