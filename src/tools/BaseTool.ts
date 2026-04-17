/**
 * Simplified BaseTool for Qwen Desktop
 * No MCP registration - tools are called directly by QueryEngine
 */

import { z, ZodType } from "zod";

export abstract class BaseTool<Input extends ZodType = any> {
    abstract name: string;
    abstract description: string;
    abstract inputSchema: Input;

    abstract execute(args: z.infer<Input>): Promise<any>;
}
