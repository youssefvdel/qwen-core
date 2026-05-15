import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './BaseTool.js';

export class FileWriteTool extends BaseTool {
 name = "file_write";
 description = "Create or overwrite a file on disk. Use this when creating new files or completely rewriting existing ones.";

 inputSchema = z.object({
 path: z.string().describe("File path to write (will be created if doesn't exist)"),
 content: z.string().describe("Content to write to the file")
 });

 async execute({ path: filePath, content }: { path: string; content: string }) {
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

 console.error(` Writing file: ${resolvedPath} (${content.length} bytes)`);

 // Ensure parent directory exists
 const dir = path.dirname(resolvedPath);
 await fs.mkdir(dir, { recursive: true });

 // Write the file
 await fs.writeFile(resolvedPath, content, 'utf-8');

 // Get file info
 const stats = await fs.stat(resolvedPath);
 const lineCount = content.split('\n').length;

 // Dynamic timeout based on content size
 const timeout = this.getTimeout('file_write', { contentSize: content.length });
 const timeoutSeconds = (timeout / 1000).toFixed(1);

 return {
 content: [{
 type: "text",
 text: ` File written successfully\nPath: ${resolvedPath}\nSize: ${stats.size} bytes\nLines: ${lineCount}\nTimeout: ${timeoutSeconds}s`
 }]
 };
 } catch (err: any) {
 return {
 content: [{ type: "text", text: ` File write error: ${err.message}` }],
 isError: true
 };
 }
 }
}
