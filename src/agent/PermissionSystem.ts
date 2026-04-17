/**
 * Permission System - Controls tool execution permissions
 * Implements allow/deny/ask patterns similar to Claude Code
 */

export type PermissionBehavior = 'allow' | 'deny' | 'ask';

export interface PermissionResult {
    behavior: PermissionBehavior;
    reason?: string;
}

export interface PermissionRule {
    pattern: string;
    behavior: PermissionBehavior;
    source: 'cli' | 'project' | 'user' | 'session';
}

export class PermissionSystem {
    private alwaysAllowRules: PermissionRule[] = [];
    private alwaysDenyRules: PermissionRule[] = [];
    private alwaysAskRules: PermissionRule[] = [];
    private shouldAvoidPrompts: boolean = false;

    constructor() {
        // Default safe rules
        this.initializeDefaultRules();
    }

    /**
     * Initialize default permission rules
     */
    private initializeDefaultRules() {
        // Safe read-only operations are allowed by default
        this.alwaysAllowRules.push(
            { pattern: 'file_read', behavior: 'allow', source: 'session' },
            { pattern: 'glob_search', behavior: 'allow', source: 'session' },
            { pattern: 'grep_search', behavior: 'allow', source: 'session' },
            { pattern: 'web_fetch', behavior: 'allow', source: 'session' },
            { pattern: 'sequential_thinking', behavior: 'allow', source: 'session' }
        );

        // Destructive operations require permission
        this.alwaysAskRules.push(
            { pattern: 'bash_execute', behavior: 'ask', source: 'session' },
            { pattern: 'file_write', behavior: 'ask', source: 'session' },
            { pattern: 'file_edit', behavior: 'ask', source: 'session' }
        );
    }

    /**
     * Add a permission rule
     */
    addRule(rule: PermissionRule) {
        switch (rule.behavior) {
            case 'allow':
                this.alwaysAllowRules.push(rule);
                break;
            case 'deny':
                this.alwaysDenyRules.push(rule);
                break;
            case 'ask':
                this.alwaysAskRules.push(rule);
                break;
        }
    }

    /**
     * Check if a tool execution is permitted
     */
    async checkPermission(toolName: string, args: any): Promise<PermissionResult> {
        // Check deny rules first (highest priority)
        for (const rule of this.alwaysDenyRules) {
            if (this.matchesPattern(toolName, rule.pattern)) {
                return {
                    behavior: 'deny',
                    reason: `Denied by ${rule.source} rule: ${rule.pattern}`
                };
            }
        }

        // Check allow rules
        for (const rule of this.alwaysAllowRules) {
            if (this.matchesPattern(toolName, rule.pattern)) {
                return {
                    behavior: 'allow',
                    reason: `Allowed by ${rule.source} rule: ${rule.pattern}`
                };
            }
        }

        // Check ask rules
        for (const rule of this.alwaysAskRules) {
            if (this.matchesPattern(toolName, rule.pattern)) {
                if (this.shouldAvoidPrompts) {
                    // In auto-mode or background execution, deny instead of asking
                    return {
                        behavior: 'deny',
                        reason: `Auto-denied (prompts disabled): ${rule.pattern}`
                    };
                }
                return {
                    behavior: 'ask',
                    reason: `Requires approval: ${rule.pattern}`
                };
            }
        }

        // Default: ask for unknown tools
        if (this.shouldAvoidPrompts) {
            return {
                behavior: 'deny',
                reason: 'Unknown tool denied (prompts disabled)'
            };
        }

        return {
            behavior: 'ask',
            reason: 'Unknown tool requires approval'
        };
    }

    /**
     * Simple pattern matching (supports wildcards)
     */
    private matchesPattern(toolName: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (pattern === toolName) return true;

        // Support glob-style patterns like "bash_*"
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(toolName);
        }

        return false;
    }

    /**
     * Enable/disable prompt avoidance (auto-mode)
     */
    setAvoidPrompts(avoid: boolean) {
        this.shouldAvoidPrompts = avoid;
    }

    /**
     * Allow all operations (bypass mode)
     */
    bypassAll() {
        this.alwaysDenyRules = [];
        this.alwaysAskRules = [];
        this.alwaysAllowRules = [
            { pattern: '*', behavior: 'allow', source: 'cli' }
        ];
    }

    /**
     * Deny all write operations (read-only mode)
     */
    readOnlyMode() {
        this.alwaysDenyRules = [
            { pattern: 'file_write', behavior: 'deny', source: 'cli' },
            { pattern: 'file_edit', behavior: 'deny', source: 'cli' },
            { pattern: 'bash_execute', behavior: 'deny', source: 'cli' }
        ];
    }

    /**
     * Reset to default rules
     */
    resetToDefaults() {
        this.alwaysAllowRules = [];
        this.alwaysDenyRules = [];
        this.alwaysAskRules = [];
        this.initializeDefaultRules();
    }

    /**
     * Get current rules summary
     */
    getRulesSummary() {
        return {
            allow: this.alwaysAllowRules.length,
            deny: this.alwaysDenyRules.length,
            ask: this.alwaysAskRules.length,
            avoidPrompts: this.shouldAvoidPrompts
        };
    }
}
