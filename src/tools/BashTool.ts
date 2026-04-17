import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './BaseTool.js';

const execAsync = promisify(exec);

// Dangerous commands that should be flagged
const DANGEROUS_PATTERNS = [
    'rm -rf /',
    'rm -rf /*',
    ':(){:|:&};:',  // fork bomb
    '> /dev/sda',
    'dd if=',
    'mkfs',
    'chmod 777 /',
    'wget.*\\|.*sh',
    'curl.*\\|.*sh'
];

export class BashTool extends BaseTool {
    name = "bash_execute";
    description = "Execute a shell command safely. Use for git operations, package management, running tests, builds, etc.";

    inputSchema = z.object({
        command: z.string().describe("Bash command to run"),
        cwd: z.string().optional().describe("Working directory (defaults to current)")
    });

    private isDangerous(command: string): boolean {
        const normalizedCommand = command.toLowerCase();

        for (const pattern of DANGEROUS_PATTERNS) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(normalizedCommand)) {
                return true;
            }
        }

        return false;
    }

    async execute({ command, cwd = process.cwd() }: { command: string; cwd?: string }) {
        try {
            // Check for dangerous commands
            if (this.isDangerous(command)) {
                return {
                    content: [{ type: "text", text: `⚠️ Command blocked for safety reasons. This command appears to be potentially destructive.` }],
                    isError: true
                };
            }

            console.error(`🐚 Executing: ${command}`);
            console.error(`   Working directory: ${cwd}`);

            const startTime = Date.now();
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                timeout: 60000 // 60 second timeout
            });
            const duration = Date.now() - startTime;

            const output = stdout || stderr || "Command completed successfully (no output).";

            // Truncate output if too large (max 100KB)
            const maxLength = 100 * 1024;
            const truncatedOutput = output.length > maxLength
                ? output.substring(0, maxLength) + '\n\n... [Output truncated - too large] ...'
                : output;

            return {
                content: [{
                    type: "text",
                    text: `[Command executed in ${duration}ms]\n${truncatedOutput}`
                }]
            };
        } catch (err: any) {
            let errorMessage = err.message;

            // Handle specific error types
            if (err.killed) {
                errorMessage = 'Command was killed (timeout or signal)';
            } else if (err.code === 'ETIMEDOUT') {
                errorMessage = 'Command timed out after 60 seconds';
            } else if (err.code === 'ENOENT') {
                errorMessage = `Command not found: ${err.message}`;
            }

            return {
                content: [{ type: "text", text: `❌ Command failed:\n${errorMessage}` }],
                isError: true
            };
        }
    }
}
