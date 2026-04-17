import { QwenProxy } from "../services/QwenProxy.js";
import { RulesEngine } from "../system/RulesEngine.js";
import { SkillLoader } from "../system/SkillLoader.js";
import { registerSequentialThinking } from "../tools/SequentialThinkingTool.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BashTool } from "../tools/BashTool.js";
import { FileReadTool } from "../tools/FileReadTool.js";
import { FileWriteTool } from "../tools/FileWriteTool.js";
import { FileEditTool } from "../tools/FileEditTool.js";
import { GlobTool } from "../tools/GlobTool.js";
import { GrepTool } from "../tools/GrepTool.js";
import { WebFetchTool } from "../tools/WebFetchTool.js";
import { ToolRegistry } from "./ToolRegistry.js";
import { SessionManager } from "./SessionManager.js";
import { PermissionSystem } from "./PermissionSystem.js";
import { z } from "zod";

export interface AgentMessage {
    role: "system" | "user" | "assistant";
    content?: string;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string;
}

export interface ToolResult {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
}

export interface AgentConfig {
    maxIterations: number;
    model: string;
    cwd: string;
    enablePermissions: boolean;
}

export class QueryEngine {
    private proxy = new QwenProxy();
    private history: AgentMessage[] = [];
    private rules = new RulesEngine();
    private skills = new SkillLoader();
    private toolRegistry: ToolRegistry;
    private sessionManager: SessionManager;
    private permissionSystem: PermissionSystem;
    private config: AgentConfig;
    private sessionId: string;
    private abortController: AbortController | null = null;

    constructor(config?: Partial<AgentConfig>) {
        this.config = {
            maxIterations: config?.maxIterations || 20,
            model: config?.model || "qwen-plus",
            cwd: config?.cwd || process.cwd(),
            enablePermissions: config?.enablePermissions ?? true,
        };

        this.toolRegistry = new ToolRegistry();
        this.sessionManager = new SessionManager();
        this.permissionSystem = new PermissionSystem();
        this.sessionId = this.generateSessionId();
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async init(cwd: string, server: McpServer) {
        await this.rules.load(cwd);
        await this.skills.load(cwd);
        registerSequentialThinking(server);

        // Register all tools
        this.registerTools(server);

        // Initialize session
        await this.sessionManager.createSession(this.sessionId, cwd);

        console.error(`✅ qwen-core initialized | Session: ${this.sessionId}`);
    }

    private registerTools(server: McpServer) {
        const bashTool = new BashTool();
        const fileReadTool = new FileReadTool();
        const fileWriteTool = new FileWriteTool();
        const fileEditTool = new FileEditTool();
        const globTool = new GlobTool();
        const grepTool = new GrepTool();
        const webFetchTool = new WebFetchTool();

        // Register tools in registry for internal use
        this.toolRegistry.register(bashTool);
        this.toolRegistry.register(fileReadTool);
        this.toolRegistry.register(fileWriteTool);
        this.toolRegistry.register(fileEditTool);
        this.toolRegistry.register(globTool);
        this.toolRegistry.register(grepTool);
        this.toolRegistry.register(webFetchTool);

        // Register with MCP server
        bashTool.register(server);
        fileReadTool.register(server);
        fileWriteTool.register(server);
        fileEditTool.register(server);
        globTool.register(server);
        grepTool.register(server);
        webFetchTool.register(server);
    }

    private getSystemPrompt(): string {
        const currentDate = new Date().toISOString().split('T')[0];
        const toolList = this.getToolListForPrompt();

        return `You are **Qwen-Core**, an autonomous coding agent inspired by Claude Code.

## Current Context
- Working Directory: ${this.config.cwd}
- Date: ${currentDate}
- Session ID: ${this.sessionId}

## System Rules
${this.rules.getRulesContext()}

## Available Skills
${this.skills.getSkillsContext()}

## Available Tools
${toolList}

## Core Principles
1. **Gather Context First**: Always read files and explore before making changes
2. **Plan Before Acting**: Use sequential thinking for complex tasks
3. **Be Precise**: Make targeted changes, avoid unnecessary modifications
4. **Verify Results**: Check that your changes work as expected
5. **Follow Rules**: Adhere to .qwenrules strictly
6. **Type Safety**: Write clean, type-safe TypeScript code
7. **Error Handling**: Handle errors gracefully, use console.error for debugging
8. **Code Quality**: Keep functions small (<50 lines), prefer early returns

## Tool Usage Guidelines
- Use **bash_execute** for shell commands (git, npm, bun, etc.)
- Use **file_read** to examine existing code before modifying
- Use **file_edit** for surgical changes to existing files
- Use **file_write** only when creating new files
- Use **glob_search** to find files by pattern
- Use **grep_search** to search file contents
- Use **web_fetch** to retrieve documentation or external resources
- Use **sequential_thinking** for planning complex multi-step tasks

## Response Format
- Be concise and direct
- Explain your reasoning briefly
- Show relevant code snippets
- Report errors clearly

## Important Notes
- NEVER commit changes unless explicitly asked
- ALWAYS verify file paths exist before editing
- Use absolute paths when possible
- If stuck, explain what you tried and what went wrong`;
    }

    private getToolListForPrompt(): string {
        const tools = this.toolRegistry.getAll();
        if (tools.length === 0) {
            return "- No tools currently registered";
        }

        const toolLines = tools.map(tool => {
            const readOnly = tool.isReadOnly ? " (read-only)" : "";
            const safe = tool.isConcurrencySafe ? " (concurrency-safe)" : "";
            return `- **${tool.name}**: ${tool.description}${readOnly}${safe}`;
        });

        return toolLines.join('\n');
    }

    private getToolDefinitions() {
        return [
            {
                type: "function",
                function: {
                    name: "bash_execute",
                    description: "Execute a shell command safely on the local machine. Use for git operations, package management, running tests, builds, etc.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: { type: "string", description: "Bash command to run" },
                            cwd: { type: "string", description: "Working directory (optional)" }
                        },
                        required: ["command"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "file_read",
                    description: "Read the contents of a file on disk. Use to examine existing code before making changes.",
                    parameters: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Absolute or relative file path" }
                        },
                        required: ["path"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "file_write",
                    description: "Create or overwrite a file on disk. Use only when creating new files.",
                    parameters: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "File path to write" },
                            content: { type: "string", description: "Content to write" }
                        },
                        required: ["path", "content"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "file_edit",
                    description: "Perform a search-and-replace edit on an existing file. Requires exact match of oldText.",
                    parameters: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "File path to edit" },
                            oldText: { type: "string", description: "Exact text to search for" },
                            newText: { type: "string", description: "Text to replace with" }
                        },
                        required: ["path", "oldText", "newText"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "glob_search",
                    description: "Find files matching a glob pattern. Use to locate files by name or extension.",
                    parameters: {
                        type: "object",
                        properties: {
                            pattern: { type: "string", description: "Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx')" },
                            path: { type: "string", description: "Base directory to search in (optional)" }
                        },
                        required: ["pattern"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "grep_search",
                    description: "Search file contents using regex patterns. Use ripgrep for fast searching.",
                    parameters: {
                        type: "object",
                        properties: {
                            pattern: { type: "string", description: "Regex pattern to search for" },
                            path: { type: "string", description: "Directory or file to search in (optional)" },
                            glob: { type: "string", description: "File filter glob (e.g., '*.ts') (optional)" }
                        },
                        required: ["pattern"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "web_fetch",
                    description: "Fetch content from a URL. Use to retrieve documentation or external resources.",
                    parameters: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "URL to fetch" },
                            prompt: { type: "string", description: "What information to extract from the page" }
                        },
                        required: ["url", "prompt"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "sequential_thinking",
                    description: "Break down complex problems into step-by-step reasoning. Use for planning before taking action.",
                    parameters: {
                        type: "object",
                        properties: {
                            thought: { type: "string", description: "Current thinking step" },
                            thoughtNumber: { type: "number", description: "Step number" },
                            totalThoughts: { type: "number", description: "Total expected steps" },
                            nextThoughtNeeded: { type: "boolean", description: "Whether more thoughts are needed" }
                        },
                        required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"]
                    }
                }
            }
        ];
    }

    /**
     * Execute a tool call and return the result
     */
    private async executeToolCall(toolCall: any): Promise<ToolResult> {
        const functionName = toolCall.function.name;
        let args: any;

        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch (err) {
            return {
                content: [{ type: "text", text: `❌ Invalid JSON arguments: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true
            };
        }

        console.error(`🛠️ Executing: ${functionName}`, args);

        // Check permissions if enabled
        if (this.config.enablePermissions) {
            const permissionCheck = await this.permissionSystem.checkPermission(functionName, args);
            if (permissionCheck.behavior === 'deny') {
                return {
                    content: [{ type: "text", text: `⚠️ Permission denied: ${permissionCheck.reason}` }],
                    isError: true
                };
            }
        }

        // Execute the appropriate tool
        try {
            switch (functionName) {
                case "bash_execute":
                    return await new BashTool().execute(args);
                case "file_read":
                    return await new FileReadTool().execute(args);
                case "file_write":
                    return await new FileWriteTool().execute(args);
                case "file_edit":
                    return await new FileEditTool().execute(args);
                case "glob_search":
                    return await new GlobTool().execute(args);
                case "grep_search":
                    return await new GrepTool().execute(args);
                case "web_fetch":
                    return await new WebFetchTool().execute(args);
                default:
                    return {
                        content: [{ type: "text", text: `❌ Unknown tool: ${functionName}` }],
                        isError: true
                    };
            }
        } catch (err) {
            return {
                content: [{ type: "text", text: `❌ Tool execution error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true
            };
        }
    }

    /**
     * Main ReAct loop - implements the core autonomous agent pattern
     * Think → Act (tool_use) → Observe (tool_result) → Repeat
     */
    async run(userMessage: string, options?: { signal?: AbortSignal }): Promise<string> {
        this.abortController = new AbortController();
        const signal = options?.signal || this.abortController.signal;

        // Add user message to history
        this.history.push({ role: "user", content: userMessage });

        // Inject system prompt on first turn
        if (this.history.filter(m => m.role === "system").length === 0) {
            this.history.unshift({ role: "system", content: this.getSystemPrompt() });
        }

        let iterations = 0;
        const maxIterations = this.config.maxIterations;

        console.error(`🚀 Starting task execution | Max iterations: ${maxIterations}`);

        while (iterations < maxIterations) {
            // Check for abort signal
            if (signal.aborted) {
                console.error("⚠️ Task aborted by user");
                return "Task was aborted.";
            }

            iterations++;
            console.error(`🔄 Agent Loop ${iterations}/${maxIterations}...`);

            try {
                // Call the LLM with current history and tool definitions
                const response = await this.proxy.chat(
                    this.history,
                    this.config.model,
                    this.getToolDefinitions()
                );

                const msg = response.choices[0].message;

                // Check if the model wants to use tools
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    console.error(`📦 Received ${msg.tool_calls.length} tool call(s)`);

                    // Add assistant message with tool calls to history
                    this.history.push({
                        role: "assistant",
                        tool_calls: msg.tool_calls
                    });

                    // Execute each tool call
                    for (const toolCall of msg.tool_calls) {
                        const result = await this.executeToolCall(toolCall);

                        // Add tool result to history
                        this.history.push({
                            role: "user",
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            content: JSON.stringify(result.content)
                        });

                        console.error(`✅ Tool result received (${result.content[0]?.text.length} chars)`);
                    }

                    // Continue the loop - model will see tool results and decide next action
                    continue;
                } else {
                    // No tool calls - model has finished
                    console.error("✨ Task completed - no more tool calls");
                    this.history.push(msg);

                    // Save session state
                    await this.sessionManager.saveSession(this.sessionId, this.history);

                    return msg.content || "Task completed with no response.";
                }
            } catch (err) {
                console.error("❌ Error in agent loop:", err);

                // Add error message to history so model can recover
                this.history.push({
                    role: "user",
                    content: `An error occurred: ${err instanceof Error ? err.message : String(err)}. Please try a different approach.`
                });

                // Continue loop to allow recovery
                continue;
            }
        }

        console.error("⚠️ Reached maximum iterations");
        return `Loop limit reached after ${maxIterations} iterations. The task may be too complex or require clarification.`;
    }

    /**
     * Cancel the current task execution
     */
    cancel() {
        if (this.abortController) {
            this.abortController.abort();
            console.error("🛑 Task cancellation requested");
        }
    }

    /**
     * Get current conversation history
     */
    getHistory(): AgentMessage[] {
        return [...this.history];
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.history = [];
        this.sessionId = this.generateSessionId();
        console.error(`🔄 History cleared | New session: ${this.sessionId}`);
    }

    /**
     * Get session info
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            messageCount: this.history.length,
            cwd: this.config.cwd,
            model: this.config.model
        };
    }
}
