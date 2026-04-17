import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { app } from 'electron';
import { logger } from '../main/logger.js';

/**
 * Agent definition - similar to Claude Code agents
 */
export interface AgentDefinition {
    agentType: string; // Unique identifier for the agent
    description: string; // When to use this agent
    systemPrompt: string; // The agent's system prompt
    tools?: string[]; // Tools this agent can use
    disallowedTools?: string[]; // Tools this agent cannot use
    skills?: string[]; // Skills to preload
    model?: string; // Model override (or 'inherit')
    effort?: 'quick' | 'medium' | 'high' | number;
    permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk';
    maxTurns?: number; // Maximum agentic turns
    color?: string; // Display color
    filename?: string; // Original filename
    baseDir?: string; // Base directory
    source: 'built-in' | 'userSettings' | 'projectSettings' | 'policySettings' | 'plugin';

    // Advanced features
    mcpServers?: string[]; // MCP servers specific to this agent
    background?: boolean; // Always run as background task
    initialPrompt?: string; // Prepended to first user turn
    memory?: 'user' | 'project' | 'local'; // Persistent memory scope
    isolation?: 'worktree'; // Run in isolated git worktree
}

/**
 * Built-in agent with dynamic prompt generation
 */
export interface BuiltInAgent extends AgentDefinition {
    source: 'built-in';
    getSystemPrompt: () => string;
}

/**
 * Custom agent from file
 */
export interface CustomAgent extends AgentDefinition {
    source: 'userSettings' | 'projectSettings' | 'policySettings' | 'plugin';
}

/**
 * Agent Loader - manages agent definitions from multiple sources
 * 
 * Features:
 * - Load agents from markdown files with frontmatter
 * - Built-in agents (Explore, Plan, etc.)
 * - Custom agents from .claude/agents/
 * - Plugin agents
 * - Agent validation
 */
export class AgentLoader {
    private agents: AgentDefinition[] = [];
    private builtInAgents: BuiltInAgent[] = [];
    private loaded: boolean = false;
    private cwd: string = '';

    constructor() {
        this.registerBuiltInAgents();
    }

    /**
     * Register built-in agents
     */
    private registerBuiltInAgents(): void {
        // Explore Agent - for codebase exploration
        this.builtInAgents.push({
            agentType: 'explore',
            description: 'Use this agent when you need to explore and understand a codebase, find specific code patterns, or analyze project structure without making changes.',
            systemPrompt: `You are an expert code explorer. Your role is to thoroughly understand codebases by reading files, searching for patterns, and mapping out architecture.

Key principles:
- Read extensively to understand context
- Use Grep and Glob to find relevant code
- Map dependencies and relationships
- Document your findings clearly
- Do NOT make any edits or run commands that modify files
- Focus on understanding, not implementing

When exploring:
1. Start with high-level structure (package.json, README, config files)
2. Identify key directories and modules
3. Trace important code paths
4. Note patterns and conventions
5. Summarize your findings`,
            tools: ['Read', 'Glob', 'Grep'],
            disallowedTools: ['Edit', 'Write', 'Bash'],
            source: 'built-in',
            color: 'blue',
            getSystemPrompt: function () { return this.systemPrompt; }
        });

        // Plan Agent - for detailed planning
        this.builtInAgents.push({
            agentType: 'plan',
            description: 'Use this agent when you need to create a detailed implementation plan before coding, break down complex tasks, or design architecture.',
            systemPrompt: `You are a senior software architect specializing in technical planning and design.

Your role:
- Break down complex requirements into actionable steps
- Design clean, maintainable architectures
- Identify potential risks and edge cases
- Create detailed implementation plans
- Consider trade-offs and alternatives

Planning process:
1. Understand requirements thoroughly
2. Research existing code and patterns
3. Design solution architecture
4. Break into manageable tasks
5. Identify dependencies and risks
6. Provide clear implementation steps

Output format:
- Clear problem statement
- Proposed solution overview
- Detailed step-by-step plan
- File changes needed
- Testing strategy
- Potential challenges`,
            tools: ['Read', 'Glob', 'Grep', 'WebFetch'],
            disallowedTools: ['Edit', 'Write'],
            source: 'built-in',
            color: 'yellow',
            getSystemPrompt: function () { return this.systemPrompt; }
        });

        // General Purpose Agent - for complex multi-step tasks
        this.builtInAgents.push({
            agentType: 'general-purpose',
            description: 'Use this agent for complex tasks that require sustained focus, multiple tool calls, and autonomous problem-solving.',
            systemPrompt: `You are a highly capable autonomous agent. You excel at breaking down complex problems and solving them systematically.

Capabilities:
- Autonomous task execution
- Multi-step problem solving
- Tool orchestration
- Error recovery and adaptation
- Quality verification

Approach:
1. Understand the goal completely
2. Break it into subtasks
3. Execute systematically
4. Verify results at each step
5. Adapt when encountering obstacles
6. Ensure quality before completion

Remember:
- Think before acting
- Verify your work
- Handle errors gracefully
- Ask for clarification when stuck
- Deliver complete solutions`,
            source: 'built-in',
            color: 'green',
            maxTurns: 50,
            getSystemPrompt: function () { return this.systemPrompt; }
        });

        logger.info(`[Agents] Registered ${this.builtInAgents.length} built-in agents`);
    }

    /**
     * Load agents from all configured directories
     */
    async load(cwd: string): Promise<void> {
        if (this.loaded) return;

        this.cwd = cwd;
        this.agents = [...this.builtInAgents];

        try {
            // Load from multiple sources
            const [
                userAgents,
                projectAgents
            ] = await Promise.all([
                this.loadAgentsFromDir(path.join(app.getPath('userData'), 'agents'), 'userSettings'),
                this.loadAgentsFromDir(path.join(cwd, '.claude', 'agents'), 'projectSettings'),
            ]);

            this.agents.push(...userAgents, ...projectAgents);

            logger.info(`🤖 Loaded ${this.agents.length} agent(s) (${this.builtInAgents.length} built-in, ${userAgents.length + projectAgents.length} custom)`);

            if (this.agents.length > this.builtInAgents.length) {
                const customAgents = this.agents.filter(a => a.source !== 'built-in');
                customAgents.forEach(a => {
                    logger.info(`   - ${a.agentType}: ${a.description.substring(0, 60)}... [${a.source}]`);
                });
            }

            this.loaded = true;
        } catch (err) {
            logger.error('⚠️ Failed to load agents:', err);
        }
    }

    /**
     * Load agents from a directory
     */
    private async loadAgentsFromDir(dirPath: string, source: AgentDefinition['source']): Promise<AgentDefinition[]> {
        const agents: AgentDefinition[] = [];

        try {
            await fs.access(dirPath);
        } catch {
            return agents; // Directory doesn't exist
        }

        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) {
                continue;
            }

            const filePath = path.join(dirPath, entry.name);

            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const agent = this.parseAgentFromMarkdown(filePath, dirPath, content, source);

                if (agent) {
                    agents.push(agent);
                }
            } catch (err) {
                logger.debug(`[Agents] Skipping ${entry.name}: ${err}`);
            }
        }

        return agents;
    }

    /**
     * Parse agent from markdown file with frontmatter
     */
    private parseAgentFromMarkdown(
        filePath: string,
        baseDir: string,
        content: string,
        source: AgentDefinition['source']
    ): AgentDefinition | null {
        try {
            // Parse frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) {
                logger.warn(`[Agents] No frontmatter found in ${filePath}`);
                return null;
            }

            const frontmatterData = yaml.load(frontmatterMatch[1]) as any;
            const systemPrompt = content.replace(frontmatterMatch[0], '').trim();

            // Validate required fields
            const agentType = frontmatterData['name'];
            const description = frontmatterData['description'];

            if (!agentType || typeof agentType !== 'string') {
                logger.warn(`[Agents] Missing 'name' in ${filePath}`);
                return null;
            }

            if (!description || typeof description !== 'string') {
                logger.warn(`[Agents] Missing 'description' in ${filePath}`);
                return null;
            }

            // Parse optional fields
            const tools = this.parseStringArray(frontmatterData['tools']);
            const disallowedTools = this.parseStringArray(frontmatterData['disallowedTools']);
            const skills = this.parseStringArray(frontmatterData['skills']);
            const mcpServers = this.parseStringArray(frontmatterData['mcpServers']);

            const agent: AgentDefinition = {
                agentType,
                description,
                systemPrompt,
                tools: tools && tools.length > 0 ? tools : undefined,
                disallowedTools: disallowedTools && disallowedTools.length > 0 ? disallowedTools : undefined,
                skills: skills && skills.length > 0 ? skills : undefined,
                mcpServers: mcpServers && mcpServers.length > 0 ? mcpServers : undefined,
                model: frontmatterData['model'],
                effort: this.parseEffort(frontmatterData['effort']),
                permissionMode: this.parsePermissionMode(frontmatterData['permissionMode']),
                maxTurns: this.parsePositiveInt(frontmatterData['maxTurns']),
                color: frontmatterData['color'],
                filename: path.basename(filePath, '.md'),
                baseDir,
                source,
                background: frontmatterData['background'] === true || frontmatterData['background'] === 'true',
                initialPrompt: frontmatterData['initialPrompt'],
                memory: this.parseMemoryScope(frontmatterData['memory']),
                isolation: frontmatterData['isolation'],
            };

            return agent;
        } catch (err) {
            logger.error(`[Agents] Failed to parse agent from ${filePath}:`, err);
            return null;
        }
    }

    /**
     * Get all available agents
     */
    getAllAgents(): AgentDefinition[] {
        return [...this.agents];
    }

    /**
     * Get agent by type
     */
    getAgent(agentType: string): AgentDefinition | undefined {
        return this.agents.find(a => a.agentType.toLowerCase() === agentType.toLowerCase());
    }

    /**
     * Get built-in agents only
     */
    getBuiltInAgents(): BuiltInAgent[] {
        return [...this.builtInAgents];
    }

    /**
     * Get custom agents only
     */
    getCustomAgents(): AgentDefinition[] {
        return this.agents.filter(a => a.source !== 'built-in');
    }

    /**
     * Check if agent exists
     */
    hasAgent(agentType: string): boolean {
        return !!this.getAgent(agentType);
    }

    /**
     * Get agent system prompt
     */
    getAgentSystemPrompt(agentType: string): string {
        const agent = this.getAgent(agentType);
        if (!agent) {
            return '';
        }

        // For built-in agents, call getSystemPrompt if available
        if (agent.source === 'built-in') {
            const builtIn = agent as BuiltInAgent;
            if (builtIn.getSystemPrompt) {
                return builtIn.getSystemPrompt();
            }
        }

        return agent.systemPrompt;
    }

    /**
     * Clear caches (for testing/reloading)
     */
    clearCaches(): void {
        this.agents = [...this.builtInAgents];
        this.loaded = false;
    }

    // Helper methods

    private parseStringArray(value: any): string[] | undefined {
        if (!value) return undefined;
        if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
        if (typeof value === 'string') {
            return value.split(/[,\n]+/).map(v => v.trim()).filter(v => v.length > 0);
        }
        return undefined;
    }

    private parseEffort(effort: any): AgentDefinition['effort'] {
        if (effort === undefined) return undefined;
        if (typeof effort === 'number') return effort;

        const validLevels = ['quick', 'medium', 'high'];
        return validLevels.includes(effort) ? effort as AgentDefinition['effort'] : undefined;
    }

    private parsePermissionMode(mode: any): AgentDefinition['permissionMode'] {
        if (!mode) return undefined;

        const validModes = ['default', 'acceptEdits', 'plan', 'dontAsk'];
        return validModes.includes(mode) ? mode as AgentDefinition['permissionMode'] : undefined;
    }

    private parsePositiveInt(value: any): number | undefined {
        if (value === undefined || value === null) return undefined;
        const num = parseInt(value);
        return num > 0 ? num : undefined;
    }

    private parseMemoryScope(scope: any): AgentDefinition['memory'] {
        if (!scope) return undefined;

        const validScopes = ['user', 'project', 'local'];
        return validScopes.includes(scope) ? scope as AgentDefinition['memory'] : undefined;
    }
}
