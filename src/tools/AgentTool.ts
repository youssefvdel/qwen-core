import { BaseTool } from './BaseTool.js';
import { AgentDefinition } from '../agent/AgentLoader.js';
import { QueryEngine } from '../agent/QueryEngine.js';
import { logger } from '../main/logger.js';
import { z } from 'zod';

/**
 * Agent Tool - allows spawning sub-agents for specialized tasks
 * Similar to Claude Code's Agent tool
 */
export class AgentTool extends BaseTool {
 name = 'Agent';
 description = `Spawn a specialized sub-agent to handle complex tasks. Use when you need focused expertise or want to delegate a task that requires sustained attention.

Available agents will be listed in the system prompt. Each agent has specific capabilities and is optimized for certain types of work.

Usage:
- Provide the agent type (e.g., "explore", "plan", "general-purpose")
- Describe the task clearly
- Include any relevant context or constraints

Example:
{
 "agent": "explore",
 "task": "Find all API endpoints in the codebase and document their request/response formats"
}`;

 inputSchema = z.object({
 agent: z.string().describe('The type of agent to spawn'),
 task: z.string().describe('The task for the agent to complete'),
 context: z.string().optional().describe('Additional context or constraints')
 });

 private availableAgents: AgentDefinition[] = [];
 private queryEngine: QueryEngine;

 constructor(queryEngine: QueryEngine) {
 super();
 this.queryEngine = queryEngine;
 }

 /**
 * Set available agents
 */
 setAvailableAgents(agents: AgentDefinition[]): void {
 this.availableAgents = agents;
 }

 /**
 * Get the tool schema for the model
 */
 getSchema(): any {
 const agentTypes = this.availableAgents.map(a => a.agentType);
 
 return {
 type: 'object',
 properties: {
 agent: {
 type: 'string',
 enum: agentTypes,
 description: 'The type of agent to spawn'
 },
 task: {
 type: 'string',
 description: 'The task for the agent to complete'
 },
 context: {
 type: 'string',
 description: 'Additional context or constraints for the agent'
 }
 },
 required: ['agent', 'task']
 };
 }

 /**
 * Execute the agent tool
 */
 async execute(params: { agent: string; task: string; context?: string }): Promise<string> {
 const { agent: agentType, task, context } = params;

 // Find the agent
 const agentDef = this.availableAgents.find(a => a.agentType.toLowerCase() === agentType.toLowerCase());
 
 if (!agentDef) {
 const availableTypes = this.availableAgents.map(a => a.agentType).join(', ');
 return `Error: Agent "${agentType}" not found. Available agents: ${availableTypes}`;
 }

 logger.info(` Spawning agent: ${agentType} for task: ${task.substring(0, 100)}...`);

 try {
 // Build the system prompt
 const systemPrompt = this.buildAgentSystemPrompt(agentDef, context);

 // Create a new query engine with custom system prompt
 const subAgentEngine = new QueryEngine({
 maxIterations: agentDef.maxTurns || 25,
 model: agentDef.model && agentDef.model !== 'inherit' ? agentDef.model : 'qwen-plus',
 systemPrompt: systemPrompt
 });

 // Execute the task
 const result = await subAgentEngine.run(task);

 logger.info(` Agent ${agentType} completed task`);

 // Format the result
 return this.formatAgentResult(agentType, result);
 } catch (err) {
 const errorMsg = err instanceof Error ? err.message : String(err);
 logger.error(` Agent ${agentType} failed:`, errorMsg);
 return `Error executing agent "${agentType}": ${errorMsg}`;
 }
 }

 /**
 * Build system prompt for the agent
 */
 private buildAgentSystemPrompt(agentDef: AgentDefinition, context?: string): string {
 let prompt = agentDef.systemPrompt;

 // Add tool restrictions if specified
 if (agentDef.tools && agentDef.tools.length > 0) {
 prompt += `\n\nYou have access to these tools: ${agentDef.tools.join(', ')}`;
 }

 if (agentDef.disallowedTools && agentDef.disallowedTools.length > 0) {
 prompt += `\n\nDo NOT use these tools: ${agentDef.disallowedTools.join(', ')}`;
 }

 // Add skills if specified
 if (agentDef.skills && agentDef.skills.length > 0) {
 prompt += `\n\nRelevant skills to apply:\n`;
 agentDef.skills.forEach(skill => {
 prompt += `- ${skill}\n`;
 });
 }

 // Add context if provided
 if (context) {
 prompt += `\n\nAdditional context:\n${context}`;
 }

 // Add effort guidance
 if (agentDef.effort) {
 const effortGuidance = this.getEffortGuidance(agentDef.effort);
 if (effortGuidance) {
 prompt += `\n\n${effortGuidance}`;
 }
 }

 return prompt;
 }

 /**
 * Get effort guidance based on effort level
 */
 private getEffortGuidance(effort: string | number): string {
 if (typeof effort === 'number') {
 return `Target effort level: ${effort} iterations`;
 }

 switch (effort) {
 case 'quick':
 return 'Focus on quick wins and essential changes. Avoid over-engineering.';
 case 'medium':
 return 'Balance thoroughness with efficiency. Aim for solid, maintainable solutions.';
 case 'high':
 return 'Be extremely thorough. Consider edge cases, test thoroughly, and ensure production quality.';
 default:
 return '';
 }
 }

 /**
 * Format agent result for display
 */
 private formatAgentResult(agentType: string, result: string): string {
 return `[Agent: ${agentType}]

${result}

---
Agent execution complete.`;
 }

 /**
 * Get list of available agents for system prompt
 */
 getAvailableAgentsList(): string {
 if (this.availableAgents.length === 0) {
 return '';
 }

 const agentList = this.availableAgents
 .map(a => `- **${a.agentType}**: ${a.description}`)
 .join('\n');

 return `
## Available Agents
${agentList}

Use the Agent tool to spawn these specialized agents for complex tasks.
`;
 }
}
