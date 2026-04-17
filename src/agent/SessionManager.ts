import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentMessage } from './QueryEngine.js';

export interface SessionInfo {
    sessionId: string;
    createdAt: number;
    lastActive: number;
    cwd: string;
    messageCount: number;
}

/**
 * Session Manager - Handles session persistence and retrieval
 * Saves conversation history to disk for resumption
 */
export class SessionManager {
    private sessionsDir: string;

    constructor(sessionsDir?: string) {
        this.sessionsDir = sessionsDir || path.join(process.cwd(), '.qwen-sessions');
    }

    /**
     * Initialize sessions directory
     */
    async init() {
        try {
            await fs.mkdir(this.sessionsDir, { recursive: true });
            console.error(`📁 Sessions directory: ${this.sessionsDir}`);
        } catch (err) {
            console.error('Failed to create sessions directory:', err);
        }
    }

    /**
     * Create a new session
     */
    async createSession(sessionId: string, cwd: string): Promise<void> {
        await this.init();

        const sessionInfo: SessionInfo = {
            sessionId,
            createdAt: Date.now(),
            lastActive: Date.now(),
            cwd,
            messageCount: 0
        };

        const infoPath = path.join(this.sessionsDir, `${sessionId}.json`);
        await fs.writeFile(infoPath, JSON.stringify(sessionInfo, null, 2));

        // Create empty messages file
        const messagesPath = path.join(this.sessionsDir, `${sessionId}.jsonl`);
        await fs.writeFile(messagesPath, '');

        console.error(`💾 Session created: ${sessionId}`);
    }

    /**
     * Save session messages
     */
    async saveSession(sessionId: string, messages: AgentMessage[]): Promise<void> {
        const messagesPath = path.join(this.sessionsDir, `${sessionId}.jsonl`);

        // Write messages in JSONL format (one JSON object per line)
        const jsonl = messages.map(msg => JSON.stringify(msg)).join('\n');
        await fs.writeFile(messagesPath, jsonl);

        // Update session info
        const infoPath = path.join(this.sessionsDir, `${sessionId}.json`);
        try {
            const info = JSON.parse(await fs.readFile(infoPath, 'utf-8')) as SessionInfo;
            info.lastActive = Date.now();
            info.messageCount = messages.length;
            await fs.writeFile(infoPath, JSON.stringify(info, null, 2));
        } catch (err) {
            console.error('Failed to update session info:', err);
        }
    }

    /**
     * Load session messages
     */
    async loadSession(sessionId: string): Promise<AgentMessage[]> {
        const messagesPath = path.join(this.sessionsDir, `${sessionId}.jsonl`);

        try {
            const content = await fs.readFile(messagesPath, 'utf-8');
            if (!content.trim()) {
                return [];
            }

            const messages = content
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));

            return messages;
        } catch (err) {
            console.error(`Failed to load session ${sessionId}:`, err);
            return [];
        }
    }

    /**
     * List all sessions
     */
    async listSessions(): Promise<SessionInfo[]> {
        try {
            const files = await fs.readdir(this.sessionsDir);
            const sessionFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.jsonl'));

            const sessions: SessionInfo[] = [];
            for (const file of sessionFiles) {
                try {
                    const content = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
                    sessions.push(JSON.parse(content));
                } catch (err) {
                    console.error(`Failed to read session file ${file}:`, err);
                }
            }

            // Sort by last active (most recent first)
            return sessions.sort((a, b) => b.lastActive - a.lastActive);
        } catch (err) {
            console.error('Failed to list sessions:', err);
            return [];
        }
    }

    /**
     * Delete a session
     */
    async deleteSession(sessionId: string): Promise<boolean> {
        try {
            const infoPath = path.join(this.sessionsDir, `${sessionId}.json`);
            const messagesPath = path.join(this.sessionsDir, `${sessionId}.jsonl`);

            await fs.unlink(infoPath).catch(() => { });
            await fs.unlink(messagesPath).catch(() => { });

            console.error(`🗑️ Session deleted: ${sessionId}`);
            return true;
        } catch (err) {
            console.error(`Failed to delete session ${sessionId}:`, err);
            return false;
        }
    }

    /**
     * Get session info
     */
    async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
        try {
            const infoPath = path.join(this.sessionsDir, `${sessionId}.json`);
            const content = await fs.readFile(infoPath, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            return null;
        }
    }

    /**
     * Clean up old sessions (older than specified days)
     */
    async cleanupOldSessions(daysOld: number = 7): Promise<number> {
        const sessions = await this.listSessions();
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

        let deletedCount = 0;
        for (const session of sessions) {
            if (session.lastActive < cutoffTime) {
                await this.deleteSession(session.sessionId);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.error(`🧹 Cleaned up ${deletedCount} old sessions`);
        }

        return deletedCount;
    }
}
