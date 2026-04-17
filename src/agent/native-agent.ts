/**
 * Native Qwen-Core Agent Integration
 * 
 * This module integrates qwen-core directly into Qwen Desktop as a built-in
 * autonomous agent (like Claude Code), replacing the old skills manager.
 * 
 * Features:
 * - Direct tool execution without MCP overhead
 * - Claude Code-style skills system
 * - Autonomous task execution
 * - Native Electron integration
 */

import { BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { QueryEngine } from './QueryEngine.js';
import { SkillLoader } from '../system/SkillLoader.js';
import { AgentLoader } from './AgentLoader.js';
import { RulesEngine } from '../system/RulesEngine.js';
import { AgentTool } from '../tools/AgentTool.js';
import { logger } from '../main/logger.js';

// Singleton instance
let agentInstance: NativeAgent | null = null;

/**
 * Native Agent - manages autonomous task execution with Claude Code-like features
 * 
 * Features:
 * - Direct tool execution without MCP overhead
 * - Claude Code-style skills system with frontmatter parsing
 * - Agent system for spawning specialized sub-agents
 * - Dynamic skill discovery from file paths
 * - Conditional skills with path filtering
 * - Bundled skills support
 * - Autonomous task execution
 * - Native Electron integration
 */
class NativeAgent {
    private queryEngine: QueryEngine;
    private skillLoader: SkillLoader;
    private agentLoader: AgentLoader;
    private agentTool: AgentTool;
    private rulesEngine: RulesEngine;
    private mainWindow: BrowserWindow | null = null;
    private isExecuting: boolean = false;

    constructor() {
        this.queryEngine = new QueryEngine({
            maxIterations: 15,
            model: 'qwen-plus'
        });

        this.skillLoader = new SkillLoader();
        this.agentLoader = new AgentLoader();
        this.agentTool = new AgentTool(this.queryEngine);
        this.rulesEngine = new RulesEngine();

        logger.info('🤖 Native Qwen-Core Agent initialized with Claude Code features');
    }

    /**
     * Initialize the agent with working directory
     */
    async initialize(cwd: string): Promise<void> {
        try {
            await this.rulesEngine.load(cwd);
            await this.skillLoader.load(cwd);
            await this.agentLoader.load(cwd);

            // Update agent tool with available agents
            this.agentTool.setAvailableAgents(this.agentLoader.getAllAgents());

            logger.info(`✅ Agent initialized in: ${cwd}`);
            logger.info(`   Rules: ${this.rulesEngine.getAllRules().length}`);
            logger.info(`   Skills: ${this.skillLoader.getAllSkills().length}`);
            logger.info(`   Agents: ${this.agentLoader.getAllAgents().length}`);
        } catch (err) {
            logger.error('❌ Failed to initialize agent:', err);
            throw err;
        }
    }

    /**
     * Set the main window reference
     */
    setWindow(win: BrowserWindow) {
        this.mainWindow = win;
        logger.info('🔗 Agent connected to main window');
    }

    /**
     * Execute an autonomous task
     */
    async executeTask(goal: string, options?: { cwd?: string }): Promise<string> {
        if (this.isExecuting) {
            throw new Error('Agent is already executing a task');
        }

        this.isExecuting = true;

        try {
            logger.info(`🚀 Starting autonomous task: ${goal.substring(0, 100)}...`);

            // Update working directory if provided
            if (options?.cwd) {
                await this.initialize(options.cwd);
            }

            // Execute the task
            const result = await this.queryEngine.run(goal);

            logger.info(`✅ Task completed`);
            return result;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`❌ Task failed: ${errorMsg}`);
            throw err;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Cancel current task execution
     */
    cancelTask(): void {
        if (this.isExecuting) {
            this.queryEngine.cancel();
            this.isExecuting = false;
            logger.info('🛑 Task cancelled');
        }
    }

    /**
     * Get available skills (Claude Code style)
     */
    async getSkills() {
        return this.skillLoader.getAllSkills();
    }

    /**
     * Get skill instructions by name with argument substitution
     */
    getSkillInstructions(skillName: string, args?: string): string {
        return this.skillLoader.getSkillInstructions(skillName, args);
    }

    /**
     * Get available agents
     */
    getAgents() {
        return this.agentLoader.getAllAgents();
    }

    /**
     * Get agent by type
     */
    getAgent(agentType: string) {
        return this.agentLoader.getAgent(agentType);
    }

    /**
     * Get agent tool for spawning sub-agents
     */
    getAgentTool(): AgentTool {
        return this.agentTool;
    }

    /**
     * Discover skills dynamically from file paths
     */
    async discoverSkills(filePaths: string[]): Promise<void> {
        await this.skillLoader.discoverSkillsForPaths(filePaths);
    }

    /**
     * Activate conditional skills for file paths
     */
    activateConditionalSkills(filePaths: string[]): string[] {
        return this.skillLoader.activateConditionalSkillsForPaths(filePaths);
    }

    /**
     * Get active rules
     */
    getRules() {
        return this.rulesEngine.getAllRules();
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            isExecuting: this.isExecuting,
            sessionInfo: this.queryEngine.getSessionInfo(),
            skillsCount: this.skillLoader.getAllSkills().length,
            agentsCount: this.agentLoader.getAllAgents().length,
            rulesCount: this.rulesEngine.getAllRules().length
        };
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.queryEngine.clearHistory();
        logger.info('🔄 Agent history cleared');
    }
}

/**
 * Get or create the singleton agent instance
 */
export function getAgent(): NativeAgent {
    if (!agentInstance) {
        agentInstance = new NativeAgent();
    }
    return agentInstance;
}

/**
 * Register IPC handlers for agent communication
 */
export function registerAgentHandlers(): void {
    const agent = getAgent();

    // Execute autonomous task
    ipcMain.handle('agent:execute-task', async (event, goal: string, options?: any) => {
        try {
            return {
                success: true,
                result: await agent.executeTask(goal, options)
            };
        } catch (err: any) {
            return {
                success: false,
                error: err.message
            };
        }
    });

    // Cancel current task
    ipcMain.handle('agent:cancel-task', () => {
        agent.cancelTask();
        return { success: true };
    });

    // Get agent status
    ipcMain.handle('agent:get-status', () => {
        return agent.getStatus();
    });

    // List available skills
    ipcMain.handle('agent:list-skills', async () => {
        try {
            const skills = await agent.getSkills();
            return { success: true, skills };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // Get skill details with optional arguments
    ipcMain.handle('agent:get-skill', (event, skillName: string, args?: string) => {
        const instructions = agent.getSkillInstructions(skillName, args);
        return {
            success: true,
            skill: {
                name: skillName,
                instructions
            }
        };
    });

    // List available agents
    ipcMain.handle('agent:list-agents', () => {
        try {
            const agents = agent.getAgents();
            return { success: true, agents };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // Get agent details
    ipcMain.handle('agent:get-agent', (event, agentType: string) => {
        const agentDef = agent.getAgent(agentType);
        if (!agentDef) {
            return { success: false, error: `Agent "${agentType}" not found` };
        }
        return {
            success: true,
            agent: {
                ...agentDef,
                systemPrompt: agent.getAgentTool().getAvailableAgentsList()
            }
        };
    });

    // Discover skills from file paths
    ipcMain.handle('agent:discover-skills', async (event, filePaths: string[]) => {
        try {
            await agent.discoverSkills(filePaths);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // Activate conditional skills
    ipcMain.handle('agent:activate-conditional-skills', (event, filePaths: string[]) => {
        try {
            const activated = agent.activateConditionalSkills(filePaths);
            return { success: true, activated };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // Get active rules
    ipcMain.handle('agent:get-rules', () => {
        return {
            success: true,
            rules: agent.getRules()
        };
    });

    // Clear history
    ipcMain.handle('agent:clear-history', () => {
        agent.clearHistory();
        return { success: true };
    });

    // Initialize agent
    ipcMain.handle('agent:initialize', async (event, cwd: string) => {
        try {
            await agent.initialize(cwd);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    logger.info('✅ Agent IPC handlers registered');
}

/**
 * Inject skill into chat input (replaces old skills manager)
 */
export async function injectSkillIntoChat(
    skillName: string,
    getMainWindow: () => BrowserWindow | null
): Promise<void> {
    const agent = getAgent();
    const win = getMainWindow();

    if (!win) {
        logger.error('[Agent] No main window available for skill injection');
        return;
    }

    const instructions = agent.getSkillInstructions(skillName);

    if (!instructions) {
        dialog.showErrorBox(
            'Skill Not Found',
            `Skill "${skillName}" not found. Check the skills directory.`
        );
        return;
    }

    // Inject the skill instructions into the chat input
    const jsCode = `
    (function() {
      var text = ${JSON.stringify(instructions + '\n\n')};
      var selectors = [
        'textarea[data-id="chat-input"]',
        'textarea[placeholder]',
        'textarea',
        'div[contenteditable="true"]',
        '[data-testid="chat-input"]'
      ];

      function findElement() {
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el) return el;
        }
        return null;
      }

      function setTextareaValue(el, text) {
        var valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        if (valueSetter) {
          var existing = el.value || '';
          valueSetter.call(el, text + existing);
        } else {
          el.value = text + (el.value || '');
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.focus();
      }

      function setContentEditable(el, text) {
        el.textContent = text + (el.textContent || '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
      }

      var el = findElement();
      if (!el) {
        console.warn('[Agent] Could not find chat input element');
        return;
      }

      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        setTextareaValue(el, text);
      } else {
        setContentEditable(el, text);
      }

      console.log('[Agent] Injected skill:', ${JSON.stringify(skillName)});
    })();
  `;

    try {
        await win.webContents.executeJavaScript(jsCode);
        logger.info(`[Agent] ✅ Injected skill: ${skillName}`);
    } catch (err) {
        logger.error(`[Agent] ❌ Failed to inject skill ${skillName}:`, err);
        dialog.showErrorBox(
            'Skill Injection Error',
            `Failed to inject skill: ${skillName}\n\n${err instanceof Error ? err.message : String(err)}`
        );
    }
}

/**
 * Build skills menu template (Claude Code style)
 */
export async function buildAgentSkillsMenu(
    getMainWindow: () => BrowserWindow | null
): Promise<Electron.MenuItemConstructorOptions[]> {
    const agent = getAgent();
    const skills = await agent.getSkills();

    const items: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Open Skills Folder',
            click: () => {
                const { shell } = require('electron');
                const skillsDir = path.join(require('electron').app.getPath('userData'), 'skills');
                shell.openPath(skillsDir);
            }
        },
        { type: 'separator' }
    ];

    if (skills.length === 0) {
        items.push({ label: 'No skills available', enabled: false });
    } else {
        for (const skill of skills) {
            items.push({
                label: `${skill.name}${skill.category ? ` (${skill.category})` : ''}`,
                toolTip: skill.description,
                click: () => injectSkillIntoChat(skill.name, getMainWindow)
            });
        }
    }

    items.push({ type: 'separator' });
    items.push({
        label: 'Reload Skills',
        click: async () => {
            const cwd = process.cwd();
            await agent.initialize(cwd);
            logger.info('[Agent] Skills reloaded');
        }
    });

    return items;
}

/**
 * Build agents menu template
 */
export async function buildAgentMenu(): Promise<Electron.MenuItemConstructorOptions[]> {
    const agent = getAgent();
    const agents = agent.getAgents();

    const items: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Open Agents Folder',
            click: () => {
                const { shell } = require('electron');
                const agentsDir = path.join(require('electron').app.getPath('userData'), 'agents');
                shell.openPath(agentsDir);
            }
        },
        { type: 'separator' }
    ];

    if (agents.length === 0) {
        items.push({ label: 'No agents available', enabled: false });
    } else {
        // Group by source
        const builtIn = agents.filter(a => a.source === 'built-in');
        const custom = agents.filter(a => a.source !== 'built-in');

        if (builtIn.length > 0) {
            items.push({ label: 'Built-in Agents', enabled: false });
            for (const agentDef of builtIn) {
                items.push({
                    label: `${agentDef.agentType}: ${agentDef.description.substring(0, 50)}...`,
                    toolTip: agentDef.description,
                    enabled: false
                });
            }
        }

        if (custom.length > 0) {
            if (builtIn.length > 0) items.push({ type: 'separator' });
            items.push({ label: 'Custom Agents', enabled: false });
            for (const agentDef of custom) {
                items.push({
                    label: `${agentDef.agentType}: ${agentDef.description.substring(0, 50)}...`,
                    toolTip: agentDef.description,
                    enabled: false
                });
            }
        }
    }

    items.push({ type: 'separator' });
    items.push({
        label: 'Reload Agents',
        click: async () => {
            const cwd = process.cwd();
            await agent.initialize(cwd);
            logger.info('[Agent] Agents reloaded');
        }
    });

    return items;
}
