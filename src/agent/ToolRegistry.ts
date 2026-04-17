/**
 * Tool Registry - Manages tool registration and lookup
 * Provides a centralized way to register, retrieve, and manage tools
 */

export interface Tool {
    name: string;
    description: string;
    execute: (args: any) => Promise<any>;
    isReadOnly?: boolean;
    isConcurrencySafe?: boolean;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    /**
     * Register a tool
     */
    register(tool: Tool) {
        this.tools.set(tool.name, tool);
        console.error(`📝 Registered tool: ${tool.name}`);
    }

    /**
     * Get a tool by name
     */
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Check if a tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get all registered tools
     */
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get all tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Remove a tool
     */
    unregister(name: string): boolean {
        return this.tools.delete(name);
    }

    /**
     * Clear all tools
     */
    clear() {
        this.tools.clear();
    }

    /**
     * Get count of registered tools
     */
    size(): number {
        return this.tools.size;
    }
}
