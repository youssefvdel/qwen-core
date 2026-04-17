#!/usr/bin/env npx tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execa } from "execa";
import * as fs from "fs/promises";
import * as path from "path";
import fg from "fast-glob";
import fetch from "node-fetch";

const server = new Server({ name: "qwen-core", version: "1.0.0" }, { capabilities: { tools: {} } });

const TOOLS = [
  { name: "bash", description: "Execute a shell command", inputSchema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Write or overwrite a file", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Search and replace text in a file", inputSchema: { type: "object", properties: { path: { type: "string" }, oldText: { type: "string" }, newText: { type: "string" } }, required: ["path", "oldText", "newText"] } },
  { name: "glob_search", description: "Find files by glob pattern", inputSchema: { type: "object", properties: { pattern: { type: "string" }, cwd: { type: "string" } }, required: ["pattern"] } },
  { name: "grep_search", description: "Search file contents with ripgrep", inputSchema: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, caseSensitive: { type: "boolean" } }, required: ["pattern"] } },
  { name: "web_fetch", description: "Fetch URL content", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "web_search", description: "Search the web via DuckDuckGo", inputSchema: { type: "object", properties: { query: { type: "string" }, numResults: { type: "number" } }, required: ["query"] } },
  { name: "todo_write", description: "Manage a todo list", inputSchema: { type: "object", properties: { todos: { type: "array", items: { type: "object", properties: { content: { type: "string" }, status: { type: "string", enum: ["pending", "done"] } } } } }, required: ["todos"] } },
  { name: "ask_user", description: "Ask the user a question", inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] } },
  { name: "sequential_thinking", description: "Break down reasoning into steps", inputSchema: { type: "object", properties: { thought: { type: "string" }, thoughtNumber: { type: "number" }, totalThoughts: { type: "number" }, nextThoughtNeeded: { type: "boolean" } }, required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"] } },
  { name: "list_skills", description: "List all installed Claude Code skills from ~/.agents/", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "load_skill", description: "Load a skill's instructions into context", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "skill_info", description: "Get metadata for a specific skill", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "bash": {
        const { stdout } = await execa(args.command, { shell: true, cwd: args.cwd, timeout: 30000 });
        return { content: [{ type: "text", text: stdout || "✅ Done" }] };
      }
      case "read_file": {
        const content = await fs.readFile(args.path, "utf-8");
        return { content: [{ type: "text", text: content }] };
      }
      case "write_file": {
        await fs.writeFile(args.path, args.content, "utf-8");
        return { content: [{ type: "text", text: `✅ Written to ${args.path}` }] };
      }
      case "edit_file": {
        let content = await fs.readFile(args.path, "utf-8");
        if (!content.includes(args.oldText)) throw new Error("oldText not found in file");
        content = content.replace(args.oldText, args.newText);
        await fs.writeFile(args.path, content, "utf-8");
        return { content: [{ type: "text", text: `✅ Edited ${args.path}` }] };
      }
      case "glob_search": {
        const files = await fg(args.pattern, { cwd: args.cwd || process.cwd(), absolute: true });
        return { content: [{ type: "text", text: files.length ? files.join("\n") : "No matches" }] };
      }
      case "grep_search": {
        const grepArgs = ["-r", args.pattern, args.path || "."];
        if (!args.caseSensitive) grepArgs.unshift("-i");
        const { stdout } = await execa("rg", grepArgs, { timeout: 10000 });
        return { content: [{ type: "text", text: stdout || "No matches" }] };
      }
      case "web_fetch": {
        const res = await fetch(args.url, { headers: { "User-Agent": "QwenCore/1.0" } });
        return { content: [{ type: "text", text: await res.text() }] };
      }
      case "web_search": {
        const query = encodeURIComponent(args.query);
        const res = await fetch(`https://duckduckgo.com/html?q=${query}&kl=wt-wt`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        const results = html.match(/<a class="result__a" href="[^"]+">[^<]+/g)?.slice(0, args.numResults || 5).map(a => a.replace(/<[^>]+>/g, "").trim()) || [];
        return { content: [{ type: "text", text: results.join("\n") || "No results" }] };
      }
      case "todo_write": {
        const list = args.todos.map((t: any, i: number) => `${i + 1}. [${t.status}] ${t.content}`).join("\n");
        return { content: [{ type: "text", text: `📋 Todos:\n${list}` }] };
      }
      case "ask_user": {
        return { content: [{ type: "text", text: `❓ [Awaiting user input] ${args.question}` }], isError: false };
      }
      case "sequential_thinking": {
        return { content: [{ type: "text", text: `[🧠 ${args.thoughtNumber}/${args.totalThoughts}] ${args.thought}` }] };
      }
      case "list_skills": {
        const lockPath = path.join(process.env.HOME || "~", ".agents/.skill-lock.json");
        try {
          const lockContent = await fs.readFile(lockPath, "utf-8");
          const lock = JSON.parse(lockContent);
          const skills = Object.keys(lock.skills || {}).map(name => ({
            name,
            source: lock.skills[name].source,
            hash: lock.skills[name].hash?.slice(0, 8)
          }));
          return { content: [{ type: "text", text: `🧩 Skills (${skills.length}):\n${skills.map(s => `- ${s.name} (${s.source}) [${s.hash}]`).join("\n")}` }] };
        } catch (e: any) {
          return { content: [{ type: "text", text: `❌ Could not read ~/.agents/.skill-lock.json: ${e.message}` }], isError: true };
        }
      }
      case "load_skill": {
        const skillPath = path.join(process.env.HOME || "~", `.agents/skills/${args.name}/SKILL.md`);
        try {
          const content = await fs.readFile(skillPath, "utf-8");
          return { content: [{ type: "text", text: `✅ Loaded skill '${args.name}':\n\n${content}` }] };
        } catch (e: any) {
          return { content: [{ type: "text", text: `❌ Could not load skill '${args.name}': ${e.message}` }], isError: true };
        }
      }
      case "skill_info": {
        const lockPath = path.join(process.env.HOME || "~", ".agents/.skill-lock.json");
        try {
          const lockContent = await fs.readFile(lockPath, "utf-8");
          const lock = JSON.parse(lockContent);
          const skill = lock.skills?.[args.name];
          if (!skill) throw new Error(`Skill '${args.name}' not found`);
          return { content: [{ type: "text", text: `📋 ${args.name}:\nSource: ${skill.source}\nHash: ${skill.hash}\nAdded: ${skill.added}` }] };
        } catch (e: any) {
          return { content: [{ type: "text", text: `❌ ${e.message}` }], isError: true };
        }
      }
      default:
        return { content: [{ type: "text", text: `❌ Unknown tool: ${name}` }], isError: true };
    }
  } catch (e: any) {
    return { content: [{ type: "text", text: `❌ ${e.message}` }], isError: true };
  }
});

async function main() {
  console.error("🌐 qwen-core starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Ready - 11 Claude Code tools loaded");
}

main().catch(e => { console.error("💥", e); process.exit(1); });
