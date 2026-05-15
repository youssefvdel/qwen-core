import { z } from 'zod';
import { BaseTool } from './BaseTool.js';
import { estimateTimeout } from '../utils/TimeoutEstimator.js';

export class WebFetchTool extends BaseTool {
    name = "web_fetch";
    description = "Fetch content from a URL and extract relevant information. Use for documentation, API references, or external resources.";

    inputSchema = z.object({
        url: z.string().url().describe("URL to fetch content from"),
        prompt: z.string().describe("What specific information to extract from the page")
    });

    async execute({ url, prompt }: { url: string; prompt: string }) {
        try {
            console.error(`🌐 Fetching: ${url}`);

            // Validate URL
            const parsedUrl = new URL(url);

            // Only allow HTTP/HTTPS
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return {
                    content: [{ type: "text", text: `❌ Invalid protocol: Only HTTP/HTTPS allowed` }],
                    isError: true
                };
            }

            // Determine URL type for dynamic timeout
            const isApi = parsedUrl.pathname.startsWith('/api/') || parsedUrl.pathname.endsWith('.json');
            const urlType = isApi ? 'api' : 'page';

            // Dynamic timeout based on URL type
            const timeout = estimateTimeout('web_fetch', { urlType });
            const timeoutSeconds = (timeout / 1000).toFixed(1);

            console.error(`   Timeout: ${timeoutSeconds}s`);

            // Fetch the URL
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Qwen-Core-Agent/1.0'
                },
                signal: AbortSignal.timeout(timeout)
            });

            if (!response.ok) {
                return {
                    content: [{ type: "text", text: `❌ HTTP error: ${response.status} ${response.statusText}` }],
                    isError: true
                };
            }

            // Get content type
            const contentType = response.headers.get('content-type') || '';

            // Handle different content types
            let content: string;

            if (contentType.includes('application/json')) {
                const json = await response.json();
                content = JSON.stringify(json, null, 2);
            } else {
                const text = await response.text();

                // Truncate if too large (max 50KB)
                const maxLength = 50 * 1024;
                if (text.length > maxLength) {
                    content = text.substring(0, maxLength) + '\n\n... [Content truncated - too large] ...';
                } else {
                    content = text;
                }
            }

            // If prompt is provided, try to extract relevant info
            let result = content;
            if (prompt && prompt.trim()) {
                result = `[URL Content]\nURL: ${url}\nPrompt: ${prompt}\n\n${content}`;
            }

            return {
                content: [{ type: "text", text: `[Fetched in ${timeoutSeconds}s timeout]\n${result}` }]
            };
        } catch (err: any) {
            if (err.name === 'TimeoutError') {
                const timeout = estimateTimeout('web_fetch');
                return {
                    content: [{ type: "text", text: `❌ Request timed out after ${(timeout / 1000).toFixed(1)} seconds` }],
                    isError: true
                };
            }

            return {
                content: [{ type: "text", text: `❌ Web fetch error: ${err.message}` }],
                isError: true
            };
        }
    }
}
