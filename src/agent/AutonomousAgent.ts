import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Autonomous Agent System for qwen-core
 * Enables autonomous AI agent capabilities like Claude Code and opencode
 */

export interface AgentConfig {
  workspaceRoot: string;
  buildCommand?: string;
  testCommand?: string;
  maxIterations: number;
  enableMaxEffort: boolean;
}

export interface ErrorRecord {
  error: string;
  timestamp: number;
  context: string;
  fixAttempted: boolean;
  fixSuccessful?: boolean;
  learnings: string[];
}

export interface TaskResult {
  success: boolean;
  iterations: number;
  errors: ErrorRecord[];
  finalState: string;
}

export class AutonomousAgent {
  private config: AgentConfig;
  private errorMemory: Map<string, ErrorRecord> = new Map();
  private taskHistory: string[] = [];
  private currentIteration: number = 0;

  constructor(config: AgentConfig) {
    this.config = {
      workspaceRoot: config.workspaceRoot || process.cwd(),
      buildCommand: config.buildCommand || 'npm run build',
      testCommand: config.testCommand || 'npm test',
      maxIterations: config.maxIterations || 10,
      enableMaxEffort: config.enableMaxEffort ?? true
    };
  }

  async executeTask(taskDescription: string): Promise<TaskResult> {
    console.error(`\n🤖 [Autonomous Agent] Starting task: ${taskDescription}`);
    console.error(`📁 Workspace: ${this.config.workspaceRoot}`);
    console.error(`🔄 Max iterations: ${this.config.maxIterations}`);
    console.error(`⚡ Max effort: ${this.config.enableMaxEffort}`);

    const result: TaskResult = {
      success: false,
      iterations: 0,
      errors: [],
      finalState: 'pending'
    };

    try {
      await this.planTask(taskDescription);

      while (this.currentIteration < this.config.maxIterations) {
        this.currentIteration++;
        console.error(`\n🔁 [Iteration ${this.currentIteration}/${this.config.maxIterations}]`);

        const buildResult = await this.runBuild();
        if (!buildResult.success) {
          console.error(`❌ Build failed: ${buildResult.error}`);
          await this.recordError('build', buildResult.error, buildResult.output);
          
          const fixResult = await this.attemptFix('build', buildResult.error);
          if (fixResult.success) {
            console.error(`✅ Fix applied successfully`);
            continue;
          } else {
            console.error(`❌ Fix attempt failed: ${fixResult.reason}`);
            result.finalState = 'build_failed';
            break;
          }
        }

        const testResult = await this.runTests();
        if (!testResult.success) {
          console.error(`❌ Tests failed: ${testResult.error}`);
          await this.recordError('test', testResult.error, testResult.output);
          
          const fixResult = await this.attemptFix('test', testResult.error);
          if (fixResult.success) {
            console.error(`✅ Fix applied successfully`);
            continue;
          } else {
            console.error(`❌ Fix attempt failed: ${fixResult.reason}`);
            result.finalState = 'test_failed';
            break;
          }
        }

        console.error(`\n✅ [Task Completed Successfully]`);
        result.success = true;
        result.finalState = 'success';
        break;
      }

      result.iterations = this.currentIteration;
      result.errors = Array.from(this.errorMemory.values());

      if (this.currentIteration >= this.config.maxIterations) {
        result.finalState = 'max_iterations_reached';
        console.error(`\n⚠️ [Max iterations reached without success]`);
      }

    } catch (error) {
      console.error(`\n💥 [Fatal Error]: ${error instanceof Error ? error.message : error}`);
      result.finalState = 'fatal_error';
      await this.recordError('fatal', error instanceof Error ? error.message : String(error), '');
    }

    return result;
  }

  private async planTask(taskDescription: string): Promise<void> {
    console.error(`\n📋 [Planning Phase]`);
    const similarErrors = this.findSimilarErrors(taskDescription);
    if (similarErrors.length > 0) {
      console.error(`⚠️ [Warning] Found ${similarErrors.length} similar past errors`);
      similarErrors.forEach((err, i) => {
        err.learnings.forEach(learning => {
          console.error(`   ${i + 1}. ${learning}`);
        });
      });
    }
    this.taskHistory.push(taskDescription);
  }

  private async runBuild(): Promise<{ success: boolean; error?: string; output: string }> {
    console.error(`\n🔨 [Running Build]`);
    console.error(`Command: ${this.config.buildCommand}`);

    try {
      const { stdout, stderr } = await execAsync(this.config.buildCommand, {
        cwd: this.config.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stderr && !stderr.includes('warning')) {
        return { success: false, error: stderr, output: stderr };
      }

      console.error(`✅ Build successful`);
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, error: error.message, output: error.stdout || error.stderr || error.message };
    }
  }

  private async runTests(): Promise<{ success: boolean; error?: string; output: string }> {
    console.error(`\n🧪 [Running Tests]`);
    console.error(`Command: ${this.config.testCommand}`);

    try {
      const { stdout, stderr } = await execAsync(this.config.testCommand, {
        cwd: this.config.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stderr && !stderr.includes('warning')) {
        return { success: false, error: stderr, output: stderr };
      }

      console.error(`✅ All tests passed`);
      return { success: true, output: stdout };
    } catch (error: any) {
      return { success: false, error: error.message, output: error.stdout || error.stderr || error.message };
    }
  }

  private async recordError(type: string, error: string, context: string): Promise<void> {
    const errorKey = this.generateErrorKey(error);
    const record: ErrorRecord = {
      error,
      timestamp: Date.now(),
      context: `${type}: ${context.substring(0, 200)}`,
      fixAttempted: false,
      learnings: []
    };

    const existingRecord = this.errorMemory.get(errorKey);
    if (existingRecord) {
      console.error(`⚠️ [Recurring Error] Seen ${existingRecord.fixAttempted ? 'before' : 'once'}`);
      record.fixAttempted = existingRecord.fixAttempted;
      record.learnings = existingRecord.learnings;
    }

    this.errorMemory.set(errorKey, record);
    console.error(`📝 [Error Recorded] Total: ${this.errorMemory.size}`);
  }

  private async attemptFix(errorType: string, error: string): Promise<{ success: boolean; reason?: string }> {
    console.error(`\n🔧 [Attempting Fix]`);
    const errorKey = this.generateErrorKey(error);
    const existingRecord = this.errorMemory.get(errorKey);

    if (existingRecord?.fixAttempted && existingRecord.fixSuccessful === false) {
      console.error(`❌ [Skipping] Previous fix failed. Need new approach.`);
      return { success: false, reason: 'Previously attempted fix failed' };
    }

    if (existingRecord) {
      existingRecord.fixAttempted = true;
    }

    const fixSuggestions = await this.generateFixSuggestions(errorType, error);
    console.error(`💡 [Fix Suggestions]: ${fixSuggestions.length} options`);

    if (existingRecord) {
      existingRecord.learnings.push(`Attempted fix for: ${error.substring(0, 100)}`);
      existingRecord.fixSuccessful = false;
    }

    return { success: false, reason: 'Fix requires manual review' };
  }

  private async generateFixSuggestions(errorType: string, error: string): Promise<string[]> {
    const suggestions: string[] = [];

    if (errorType === 'build') {
      if (error.includes('Cannot find module')) {
        suggestions.push('Install missing module: npm install <module>');
        suggestions.push('Check tsconfig.json paths');
      } else if (error.includes('TS2304') || error.includes('Cannot find name')) {
        suggestions.push('Add missing type definitions or imports');
      }
    } else if (errorType === 'test') {
      if (error.includes('Expected') && error.includes('to be')) {
        suggestions.push('Review test expectations vs implementation');
      } else if (error.includes('timeout')) {
        suggestions.push('Increase timeout or optimize code');
      }
    }

    if (this.config.enableMaxEffort) {
      suggestions.push('Run comprehensive analysis with max-effort');
      suggestions.push('Search codebase for similar issues');
      suggestions.push('Review git history for recent changes');
    }

    return suggestions;
  }

  private findSimilarErrors(query: string): ErrorRecord[] {
    const similar: ErrorRecord[] = [];
    const queryLower = query.toLowerCase();
    for (const record of this.errorMemory.values()) {
      if (record.error.toLowerCase().includes(queryLower) || queryLower.includes(record.error.toLowerCase())) {
        similar.push(record);
      }
    }
    return similar;
  }

  private generateErrorKey(error: string): string {
    return error.substring(0, 200).replace(/\s+/g, ' ').trim();
  }

  getErrorMemorySummary(): string {
    const total = this.errorMemory.size;
    const fixed = Array.from(this.errorMemory.values()).filter(r => r.fixSuccessful).length;
    const failed = Array.from(this.errorMemory.values()).filter(r => r.fixSuccessful === false).length;
    return `Error Memory: ${total} total, ${fixed} fixed, ${failed} unresolved`;
  }

  clearErrorMemory(): void {
    console.error(`🗑️ [Clearing Error Memory] ${this.errorMemory.size} records removed`);
    this.errorMemory.clear();
  }
}

let agentInstance: AutonomousAgent | null = null;

export function getAutonomousAgent(config?: Partial<AgentConfig>): AutonomousAgent {
  if (!agentInstance) {
    agentInstance = new AutonomousAgent({
      workspaceRoot: process.cwd(),
      maxIterations: 10,
      enableMaxEffort: true,
      ...config
    });
  }
  return agentInstance;
}

export async function executeAutonomousTask(args: {
  task: string;
  workspaceRoot?: string;
  buildCommand?: string;
  testCommand?: string;
  maxIterations?: number;
}): Promise<any> {
  const agent = getAutonomousAgent({
    workspaceRoot: args.workspaceRoot,
    buildCommand: args.buildCommand,
    testCommand: args.testCommand,
    maxIterations: args.maxIterations
  });

  const result = await agent.executeTask(args.task);

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}

export function getErrorMemoryStatus(): string {
  return getAutonomousAgent().getErrorMemorySummary();
}

export function clearErrorMemory(): void {
  getAutonomousAgent().clearErrorMemory();
}
