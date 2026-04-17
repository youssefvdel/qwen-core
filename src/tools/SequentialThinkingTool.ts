import { z } from 'zod';

export interface ThoughtRecord {
    thought: string;
    thoughtNumber: number;
    totalThoughts: number;
    timestamp: number;
    isRevision?: boolean;
    revisesThought?: number;
}

// Store thinking history for context
const thinkingHistory: ThoughtRecord[] = [];

/**
 * Execute a sequential thinking step
 */
export async function executeSequentialThinking(args: {
    thought: string;
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    isRevision?: boolean;
    revisesThought?: number;
}): Promise<any> {
    const { thought, thoughtNumber, totalThoughts, nextThoughtNeeded, isRevision, revisesThought } = args;
    const timestamp = Date.now();

    // Record the thought
    const record: ThoughtRecord = {
        thought,
        thoughtNumber,
        totalThoughts,
        timestamp,
        isRevision,
        revisesThought
    };

    thinkingHistory.push(record);

    // Format log message
    const revisionTag = isRevision ? " [REVISION]" : "";
    const log = `[🧠 Thought ${thoughtNumber}/${totalThoughts}${revisionTag}] ${thought}`;
    console.error(log);

    // Build response
    let responseText = `✅ Thought logged (${thoughtNumber}/${totalThoughts})\n\n`;
    responseText += `"${thought}"\n\n`;

    if (!nextThoughtNeeded) {
        responseText += "Ready to take action based on this analysis.";
    } else {
        const remaining = totalThoughts - thoughtNumber;
        responseText += `${remaining} thought(s) remaining in current plan.`;
    }

    return {
        content: [{ type: "text", text: responseText }]
    };
}

/**
 * Get the thinking history (for debugging or context)
 */
export function getThinkingHistory(): ThoughtRecord[] {
    return [...thinkingHistory];
}

/**
 * Clear the thinking history
 */
export function clearThinkingHistory() {
    thinkingHistory.length = 0;
}
