import { z, ZodType } from "zod";
import { validatePath } from "../utils/PathValidator.js";
import { estimateTimeout, OperationType, TimeoutOptions } from "../utils/TimeoutEstimator.js";

export abstract class BaseTool<Input extends ZodType = any> {
 abstract name: string;
 abstract description: string;
 abstract inputSchema: Input;

 abstract execute(args: z.infer<Input>): Promise<any>;

 /**
 * Validate that a file path is within allowed directories
 */
 protected validateFilePath(filePath: string): { valid: boolean; error?: string } {
 const result = validatePath(filePath);
 if (!result.allowed) {
 return { valid: false, error: result.error };
 }
 return { valid: true };
 }

 /**
 * Get dynamic timeout for an operation
 */
 protected getTimeout(operationType: OperationType, options: TimeoutOptions = {}): number {
 return estimateTimeout(operationType, options);
 }
}
