#!/usr/bin/env npx tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execa } from "execa";
import * as fs from "fs/promises";
import * as path from "path";
import fg from "fast-glob";
import fetch from "node-fetch";
import simpleGit from "simple-git";
import { z } from "zod";

const server = new Server({ name: "qwen-core", version: "2.0.0" }, { capabilities: { tools: {}, prompts: {} } });

const TOOLS = [
  {
    name: "bash",
    description: "Execute a shell command with timeout and working directory support",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        cwd: { type: "string", description: "Working directory" },
        timeout: { type: "number", description: "Timeout in ms (default: 30000)" }
      },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: "Read file contents with UTF-8 encoding",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        encoding: { type: "string", description: "File encoding (default: utf-8)" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Create or overwrite a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_file",
    description: "Search and replace text in a file with multiple replacements support",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        oldText: { type: "string", description: "Text to find" },
        newText: { type: "string", description: "Replacement text" },
        replaceAll: { type: "boolean", description: "Replace all occurrences (default: false)" }
      },
      required: ["path", "oldText", "newText"]
    }
  },
  {
    name: "glob_search",
    description: "Find files by glob pattern with cwd support",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern" },
        cwd: { type: "string", description: "Working directory" },
        absolute: { type: "boolean", description: "Return absolute paths" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "grep_search",
    description: "Search file contents using ripgrep or grep",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (regex supported)" },
        path: { type: "string", description: "Directory to search (default: .)" },
        caseSensitive: { type: "boolean", description: "Case sensitive search" },
        filePattern: { type: "string", description: "File pattern filter" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "web_fetch",
    description: "Fetch URL content and convert to markdown",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        maxLength: { type: "number", description: "Max characters to return (default: 5000)" }
      },
      required: ["url"]
    }
  },
  {
    name: "web_search",
    description: "Search the web via DuckDuckGo",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        numResults: { type: "number", description: "Number of results (default: 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "todo_write",
    description: "Manage a structured todo list",
    inputSchema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "done"] }
            }
          }
        }
      },
      required: ["todos"]
    }
  },
  {
    name: "ask_user",
    description: "Prompt for user input during execution",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Question to ask" }
      },
      required: ["question"]
    }
  },
  {
    name: "sequential_thinking",
    description: "Break down reasoning into structured steps",
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string", description: "Current thought" },
        thoughtNumber: { type: "number", description: "Current thought number" },
        totalThoughts: { type: "number", description: "Total expected thoughts" },
        nextThoughtNeeded: { type: "boolean", description: "Whether more thoughts needed" }
      },
      required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"]
    }
  },
  {
    name: "git_status",
    description: "Show git working tree status",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Path to git repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "git_diff",
    description: "Show git diff (staged, unstaged, or between commits)",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Path to git repository" },
        staged: { type: "boolean", description: "Show staged changes" },
        target: { type: "string", description: "Target branch/commit for comparison" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "git_commit",
    description: "Commit staged changes with message",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Path to git repository" },
        message: { type: "string", description: "Commit message" }
      },
      required: ["repoPath", "message"]
    }
  },
  {
    name: "git_add",
    description: "Stage files for commit",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Path to git repository" },
        files: { type: "array", items: { type: "string" }, description: "Files to stage" }
      },
      required: ["repoPath", "files"]
    }
  },
  {
    name: "git_log",
    description: "Show git commit history",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Path to git repository" },
        maxCount: { type: "number", description: "Max commits to show (default: 10)" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "get_current_time",
    description: "Get current time in a specific timezone",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "IANA timezone name (e.g., 'America/New_York')" }
      },
      required: ["timezone"]
    }
  },
  {
    name: "convert_time",
    description: "Convert time between timezones",
    inputSchema: {
      type: "object",
      properties: {
        sourceTimezone: { type: "string", description: "Source IANA timezone" },
        time: { type: "string", description: "Time in HH:MM format" },
        targetTimezone: { type: "string", description: "Target IANA timezone" }
      },
      required: ["sourceTimezone", "time", "targetTimezone"]
    }
  },
  {
    name: "read_pdf",
    description: "Extract text, metadata, and images from PDF files",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to PDF file" },
        pages: { type: "string", description: "Pages to extract (e.g., '1-5,10')" },
        includeText: { type: "boolean", description: "Extract text (default: true)" },
        includeMetadata: { type: "boolean", description: "Extract metadata (default: true)" },
        includeImages: { type: "boolean", description: "Extract images (default: false)" }
      },
      required: ["path"]
    }
  },
  {
    name: "list_skills",
    description: "List all installed Claude Code skills from ~/.agents/",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "load_skill",
    description: "Load a skill's instructions into context",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Skill name" }
      },
      required: ["name"]
    }
  },
  {
    name: "skill_info",
    description: "Get metadata for a specific skill",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Skill name" }
      },
      required: ["name"]
    }
  },
  // Enhanced Filesystem Tools (from @modelcontextprotocol/server-filesystem)
  {
    name: "read_text_file",
    description: "Read complete contents of a file as text with optional line limits",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        head: { type: "number", description: "Read only first N lines" },
        tail: { type: "number", description: "Read only last N lines" }
      },
      required: ["path"]
    }
  },
  {
    name: "read_multiple_files",
    description: "Read multiple files simultaneously",
    inputSchema: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" }, description: "Array of file paths" }
      },
      required: ["paths"]
    }
  },
  {
    name: "list_directory",
    description: "List directory contents with [FILE] or [DIR] prefixes",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list" }
      },
      required: ["path"]
    }
  },
  {
    name: "list_directory_with_sizes",
    description: "List directory contents with file sizes and summary statistics",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list" },
        sortBy: { type: "string", enum: ["name", "size"], description: "Sort entries by name or size" }
      },
      required: ["path"]
    }
  },
  {
    name: "directory_tree",
    description: "Get recursive JSON tree structure of directory contents",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Starting directory" },
        excludePatterns: { type: "array", items: { type: "string" }, description: "Glob patterns to exclude" }
      },
      required: ["path"]
    }
  },
  {
    name: "create_directory",
    description: "Create new directory or ensure it exists (creates parents if needed)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to create" }
      },
      required: ["path"]
    }
  },
  {
    name: "move_file",
    description: "Move or rename files and directories",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source file/directory path" },
        destination: { type: "string", description: "Destination path" }
      },
      required: ["source", "destination"]
    }
  },
  {
    name: "search_files",
    description: "Recursively search for files/directories matching patterns",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Starting directory" },
        pattern: { type: "string", description: "Search pattern (glob-style)" },
        excludePatterns: { type: "array", items: { type: "string" }, description: "Patterns to exclude" }
      },
      required: ["path", "pattern"]
    }
  },
  {
    name: "get_file_info",
    description: "Get detailed file/directory metadata (size, dates, permissions)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File or directory path" }
      },
      required: ["path"]
    }
  },
  {
    name: "delete_file",
    description: "Delete a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to delete" }
      },
      required: ["path"]
    }
  },
  {
    name: "delete_directory",
    description: "Delete a directory and its contents",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to delete" },
        recursive: { type: "boolean", description: "Delete recursively (default: true)" }
      },
      required: ["path"]
    }
  },
  // Desktop Commander Tools (system commands)
  {
    name: "execute_command",
    description: "Execute system command with output capture (alias for bash)",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        cwd: { type: "string", description: "Working directory" }
      },
      required: ["command"]
    }
  },
  {
    name: "list_processes",
    description: "List running processes",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter pattern for process names" }
      },
      required: []
    }
  },
  {
    name: "kill_process",
    description: "Terminate a running process by PID",
    inputSchema: {
      type: "object",
      properties: {
        pid: { type: "number", description: "Process ID to kill" }
      },
      required: ["pid"]
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, any>;
  try {
    switch (name) {
      case "bash": {
        const { stdout, stderr } = await execa(a.command, { 
          shell: true, 
          cwd: a.cwd || process.cwd(), 
          timeout: a.timeout || 30000 
        });
        return { content: [{ type: "text", text: stdout || stderr || "✅ Done" }] };
      }
      
      case "read_file": {
        const content = await fs.readFile(a.path, a.encoding || "utf-8");
        return { content: [{ type: "text", text: content }] };
      }
      
      case "write_file": {
        await fs.mkdir(path.dirname(a.path), { recursive: true });
        await fs.writeFile(a.path, a.content, "utf-8");
        return { content: [{ type: "text", text: `✅ Written to ${a.path}` }] };
      }
      
      case "edit_file": {
        let content = await fs.readFile(a.path, "utf-8");
        if (!content.includes(a.oldText)) {
          throw new Error(`oldText not found in file. First 500 chars: ${content.slice(0, 500)}`);
        }
        content = a.replaceAll 
          ? content.split(a.oldText).join(a.newText)
          : content.replace(a.oldText, a.newText);
        await fs.writeFile(a.path, content, "utf-8");
        return { content: [{ type: "text", text: `✅ Edited ${a.path}` }] };
      }
      
      case "glob_search": {
        const files = await fg(a.pattern, { 
          cwd: a.cwd || process.cwd(), 
          absolute: a.absolute ?? false 
        });
        return { content: [{ type: "text", text: files.length ? files.join("\n") : "No matches" }] };
      }
      
      case "grep_search": {
        const grepArgs = ["-r", a.pattern, a.path || "."];
        if (!a.caseSensitive) grepArgs.unshift("-i");
        if (a.filePattern) grepArgs.push("--glob", a.filePattern);
        try {
          const { stdout } = await execa("rg", grepArgs, { timeout: 10000 });
          return { content: [{ type: "text", text: stdout || "No matches" }] };
        } catch (e: any) {
          if (e.code === "ENOENT") {
            const { stdout } = await execa("grep", ["-r", a.pattern, a.path || "."], { timeout: 10000 });
            return { content: [{ type: "text", text: stdout || "No matches" }] };
          }
          throw e;
        }
      }
      
      case "web_fetch": {
        const res = await fetch(a.url, { headers: { "User-Agent": "QwenCore/2.0" } });
        const html = await res.text();
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        return { content: [{ type: "text", text: text.slice(0, a.maxLength || 5000) }] };
      }
      
      case "web_search": {
        const query = encodeURIComponent(a.query);
        const res = await fetch(`https://duckduckgo.com/html?q=${query}&kl=wt-wt`, { 
          headers: { "User-Agent": "Mozilla/5.0" } 
        });
        const html = await res.text();
        const results = html.match(/<a class="result__a" href="[^"]+">[^<]+/g)
          ?.slice(0, a.numResults || 5)
          .map(a => a.replace(/<[^>]+>/g, "").trim()) || [];
        return { content: [{ type: "text", text: results.join("\n") || "No results" }] };
      }
      
      case "todo_write": {
        const list = a.todos.map((t: any, i: number) => 
          `${i + 1}. [${t.status || "pending"}] ${t.content}`
        ).join("\n");
        return { content: [{ type: "text", text: `📋 Todos:\n${list}` }] };
      }
      
      case "ask_user": {
        return { 
          content: [{ type: "text", text: `❓ [Awaiting user input] ${a.question}` }], 
          isError: false 
        };
      }
      
      case "sequential_thinking": {
        return { 
          content: [{ type: "text", text: `[🧠 ${a.thoughtNumber}/${a.totalThoughts}] ${a.thought}` }] 
        };
      }
      
      case "git_status": {
        const git = simpleGit(a.repoPath || process.cwd());
        const status = await git.status();
        return { 
          content: [{ 
            type: "text", 
            text: `📊 Git Status:\n${status.files.map((f: any) => `  ${f.path} (${f.status})`).join("\n") || "Working tree clean"}` 
          }] 
        };
      }
      
      case "git_diff": {
        const git = simpleGit(a.repoPath || process.cwd());
        let diff;
        if (a.staged) {
          diff = await git.diff(["--cached"]);
        } else if (a.target) {
          diff = await git.diff([a.target]);
        } else {
          diff = await git.diff();
        }
        return { content: [{ type: "text", text: diff || "No changes" }] };
      }
      
      case "git_commit": {
        const git = simpleGit(a.repoPath || process.cwd());
        await git.commit(a.message);
        const log = await git.log({ maxCount: 1 });
        return { 
          content: [{ type: "text", text: `✅ Committed: ${log.latest?.hash}\n${log.latest?.message}` }] 
        };
      }
      
      case "git_add": {
        const git = simpleGit(a.repoPath || process.cwd());
        await git.add(a.files);
        return { content: [{ type: "text", text: `✅ Staged: ${a.files.join(", ")}` }] };
      }
      
      case "git_log": {
        const git = simpleGit(a.repoPath || process.cwd());
        const log = await git.log({ maxCount: a.maxCount || 10 });
        return { 
          content: [{ 
            type: "text", 
            text: log.all.map((c: any, i: number) => 
              `${i + 1}. ${c.hash.slice(0, 8)} - ${c.message} (${c.author_name}, ${c.date})`
            ).join("\n") 
          }] 
        };
      }
      
      case "get_current_time": {
        const now = new Date();
        const timeString = now.toLocaleString("en-US", { timeZone: a.timezone });
        const offset = new Date().toLocaleString("en-US", { 
          timeZone: a.timezone, 
          timeZoneName: "short" 
        }).split(" ").pop();
        return { 
          content: [{ 
            type: "text", 
            text: `🕐 Current time in ${a.timezone}: ${timeString} (${offset})` 
          }] 
        };
      }
      
      case "convert_time": {
        const [hours, minutes] = a.time.split(":").map(Number);
        const now = new Date();
        now.setHours(hours, minutes);
        
        const sourceTime = new Date(now.toLocaleString("en-US", { timeZone: a.sourceTimezone }));
        const targetTime = new Date(sourceTime.toLocaleString("en-US", { timeZone: a.targetTimezone }));
        
        return { 
          content: [{ 
            type: "text", 
            text: `🕐 ${a.time} in ${a.sourceTimezone} = ${targetTime.toLocaleTimeString("en-US", { 
              timeZone: a.targetTimezone,
              hour: "2-digit",
              minute: "2-digit"
            })} in ${a.targetTimezone}` 
          }] 
        };
      }
      
      case "read_pdf": {
        const pdfParse = await import("pdf-parse");
        const pdfBuffer = await fs.readFile(a.path);
        const data = await pdfParse.default(pdfBuffer);
        
        let result = "";
        if (a.includeText !== false) {
          result += `📄 Text Content:\n${data.text}\n\n`;
        }
        if (a.includeMetadata !== false) {
          result += `📋 Metadata:\n`;
          result += `  Pages: ${data.numpages}\n`;
          result += `  Version: ${data.version}\n`;
          if (data.info?.Title) result += `  Title: ${data.info.Title}\n`;
          if (data.info?.Author) result += `  Author: ${data.info.Author}\n`;
          if (data.info?.CreationDate) result += `  Created: ${data.info.CreationDate}\n`;
        }
        return { content: [{ type: "text", text: result.trim() }] };
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
          return { 
            content: [{ 
              type: "text", 
              text: `🧩 Skills (${skills.length}):\n${skills.map(s => `- ${s.name} (${s.source}) [${s.hash}]`).join("\n")}` 
            }] 
          };
        } catch (e: any) {
          return { 
            content: [{ 
              type: "text", 
              text: `❌ Could not read ~/.agents/.skill-lock.json: ${e.message}` 
            }], 
            isError: true 
          };
        }
      }
      
      case "load_skill": {
        const skillPath = path.join(process.env.HOME || "~", `.agents/skills/${a.name}/SKILL.md`);
        try {
          const content = await fs.readFile(skillPath, "utf-8");
          return { 
            content: [{ 
              type: "text", 
              text: `✅ Loaded skill '${a.name}':\n\n${content}` 
            }] 
          };
        } catch (e: any) {
          return { 
            content: [{ 
              type: "text", 
              text: `❌ Could not load skill '${a.name}': ${e.message}` 
            }], 
            isError: true 
          };
        }
      }
      
      case "skill_info": {
        const lockPath = path.join(process.env.HOME || "~", ".agents/.skill-lock.json");
        try {
          const lockContent = await fs.readFile(lockPath, "utf-8");
          const lock = JSON.parse(lockContent);
          const skill = lock.skills?.[a.name];
          if (!skill) throw new Error(`Skill '${a.name}' not found`);
          return { 
            content: [{ 
              type: "text", 
              text: `📋 ${a.name}:\nSource: ${skill.source}\nHash: ${skill.hash}\nAdded: ${skill.added}` 
            }] 
          };
        } catch (e: any) {
          return { 
            content: [{ type: "text", text: `❌ ${e.message}` }], 
            isError: true 
          };
        }
      }
      
      // Enhanced Filesystem Tools
      case "read_text_file": {
        let content = await fs.readFile(a.path, "utf-8");
        if (a.head && !a.tail) {
          content = content.split('\n').slice(0, a.head).join('\n');
        } else if (a.tail && !a.head) {
          content = content.split('\n').slice(-a.tail).join('\n');
        }
        return { content: [{ type: "text", text: content }] };
      }
      
      case "read_multiple_files": {
        const results = [];
        for (const p of a.paths) {
          try {
            const content = await fs.readFile(p, "utf-8");
            results.push(`=== ${p} ===\n${content}`);
          } catch (e: any) {
            results.push(`=== ${p} ===\n❌ Error: ${e.message}`);
          }
        }
        return { content: [{ type: "text", text: results.join('\n\n') }] };
      }
      
      case "list_directory": {
        const entries = await fs.readdir(a.path, { withFileTypes: true });
        const output = entries.map(e => e.isDirectory() ? `[DIR]  ${e.name}` : `[FILE] ${e.name}`).sort().join('\n');
        return { content: [{ type: "text", text: output || "Empty directory" }] };
      }
      
      case "list_directory_with_sizes": {
        const entries = await fs.readdir(a.path, { withFileTypes: true });
        const items = [];
        let totalSize = 0;
        let fileCount = 0;
        
        for (const e of entries) {
          const fullPath = path.join(a.path, e.name);
          try {
            const stats = await fs.stat(fullPath);
            if (e.isFile()) {
              totalSize += stats.size;
              fileCount++;
              items.push({ name: e.name, type: 'file', size: stats.size, modified: stats.mtime });
            } else {
              items.push({ name: e.name, type: 'directory', size: 0, modified: stats.mtime });
            }
          } catch {}
        }
        
        if (a.sortBy === "size") {
          items.sort((a, b) => b.size - a.size);
        } else {
          items.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        const output = items.map(i => 
          i.type === 'file' 
            ? `[FILE] ${i.name} (${(i.size / 1024).toFixed(1)} KB)`
            : `[DIR]  ${i.name}`
        ).join('\n');
        
        return { 
          content: [{ 
            type: "text", 
            text: `${output}\n\n📊 Summary: ${fileCount} files, ${(totalSize / 1024).toFixed(1)} KB total` 
          }] 
        };
      }
      
      case "directory_tree": {
        async function buildTree(dirPath: string, depth = 0): Promise<any[]> {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          const result = [];
          
          for (const e of entries) {
            if (e.isDirectory()) {
              const children = await buildTree(path.join(dirPath, e.name), depth + 1);
              result.push({ name: e.name, type: 'directory', children });
            } else {
              result.push({ name: e.name, type: 'file' });
            }
          }
          
          return result;
        }
        
        const tree = await buildTree(a.path);
        return { content: [{ type: "text", text: JSON.stringify(tree, null, 2) }] };
      }
      
      case "create_directory": {
        await fs.mkdir(a.path, { recursive: true });
        return { content: [{ type: "text", text: `✅ Created: ${a.path}` }] };
      }
      
      case "move_file": {
        await fs.rename(a.source, a.destination);
        return { content: [{ type: "text", text: `✅ Moved: ${a.source} → ${a.destination}` }] };
      }
      
      case "search_files": {
        const matches = await fg(a.pattern, { 
          cwd: a.path, 
          ignore: a.excludePatterns || [],
          absolute: true 
        });
        return { content: [{ type: "text", text: matches.length ? matches.join('\n') : "No matches" }] };
      }
      
      case "get_file_info": {
        const stats = await fs.stat(a.path);
        const info = {
          path: a.path,
          type: stats.isFile() ? "file" : "directory",
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime,
          permissions: stats.mode.toString(8).slice(-3)
        };
        return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
      }
      
      case "delete_file": {
        await fs.unlink(a.path);
        return { content: [{ type: "text", text: `✅ Deleted: ${a.path}` }] };
      }
      
      case "delete_directory": {
        await fs.rm(a.path, { recursive: a.recursive !== false, force: true });
        return { content: [{ type: "text", text: `✅ Deleted: ${a.path}` }] };
      }
      
      // Desktop Commander Tools
      case "execute_command": {
        const { stdout, stderr } = await execa(a.command, { 
          shell: true, 
          cwd: a.cwd || process.cwd(), 
          timeout: 30000 
        });
        return { content: [{ type: "text", text: stdout || stderr || "✅ Done" }] };
      }
      
      case "list_processes": {
        const { stdout } = await execa("ps", ["aux"]);
        const lines = a.filter 
          ? stdout.split('\n').filter(l => l.includes(a.filter))
          : stdout.split('\n');
        return { content: [{ type: "text", text: lines.slice(0, 50).join('\n') || "No processes found" }] };
      }
      
      case "kill_process": {
        await execa("kill", [String(a.pid)]);
        return { content: [{ type: "text", text: `✅ Killed process ${a.pid}` }] };
      }
      
      default:
        return { 
          content: [{ type: "text", text: `❌ Unknown tool: ${name}` }], 
          isError: true 
        };
    }
  } catch (e: any) {
    return { 
      content: [{ type: "text", text: `❌ ${e.message}` }], 
      isError: true 
    };
  }
});

// Prompt templates for autonomous agent behavior
const PROMPTS = [
  {
    name: "autonomous-agent",
    description: "System prompt for autonomous AI agent behavior with tool usage patterns",
    arguments: []
  },
  {
    name: "skill-loader",
    description: "Load and apply skills from ~/.agents/skills/ or ./skills/",
    arguments: [
      { name: "skillName", description: "Name of the skill to load", required: false }
    ]
  },
  {
    name: "task-planner",
    description: "Break down complex tasks into sequential steps with todo tracking",
    arguments: [
      { name: "task", description: "The task to plan", required: true }
    ]
  }
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, any> | undefined;
  
  try {
    switch (name) {
      case "autonomous-agent": {
        const autonomousPrompt = `You are an autonomous AI agent with access to 21 tools.

CORE PROTOCOL:
1. THINK FIRST: Use sequential_thinking before any complex action
2. PLAN: Break tasks into steps using todo_write
3. ACT: Use appropriate tools deliberately
4. OBSERVE: Check results carefully
5. CORRECT: If wrong, acknowledge, analyze, and retry

TOOL USAGE PATTERNS:
- File ops: read_file → edit_file → verify with read_file
- Git: git_status → make changes → git_diff → git_add → git_commit
- Search: glob_search (find files) → grep_search (find content) → read_file
- Debug: sequential_thinking → read_file → grep_search → fix → verify
- Research: web_search → web_fetch → synthesize → apply

SKILLS SYSTEM:
Skills are loaded from:
1. ~/.agents/skills/{name}/SKILL.md - Global skills
2. ./skills/{name}/SKILL.md - Project skills
3. ./.qwen/skills/{name}/SKILL.md - Alternative project skills

To use a skill, either:
- Call load_skill tool: {"name": "skillname"}
- The skill instructions will be injected into context

AVAILABLE CORE SKILLS:
- autonomous-agent: This prompt (auto-loaded)
- tdd: Test-Driven Development workflow
- git: Git best practices
- security-review: Security auditing
- frontend-design: UI/UX patterns
- optimize: Performance optimization
- audit: Code quality review

ERROR RECOVERY:
1. Acknowledge the error
2. Use sequential_thinking to analyze why
3. Create a new plan
4. Execute with corrections
5. Verify the fix

SAFETY RULES:
- Read files before editing
- Verify git diffs before committing
- Ask before destructive operations
- Log important decisions in todos

COMMUNICATION:
- Be direct and concise
- Explain your reasoning
- Report progress on complex tasks
- Ask for clarification when needed

Remember: You are autonomous. Think → Plan → Act → Observe → Correct.`;
        return {
          messages: [{
            role: "system",
            content: { type: "text", text: autonomousPrompt }
          }]
        };
      }
      
      case "skill-loader": {
        const skillName = a?.skillName;
        let skillsContent = "";
        
        // Try to load all available skills
        const skillPaths = [
          path.join(process.env.HOME || "~", ".agents/skills"),
          path.join(process.cwd(), "skills"),
          path.join(process.cwd(), ".qwen/skills")
        ];
        
        const availableSkills: Array<{ name: string; source: string }> = [];
        
        for (const skillPath of skillPaths) {
          try {
            const entries = await fs.readdir(skillPath, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const skillFile = path.join(skillPath, entry.name, "SKILL.md");
                try {
                  await fs.access(skillFile);
                  availableSkills.push({ name: entry.name, source: skillPath });
                } catch {
                  // No SKILL.md in this directory
                }
              }
            }
          } catch {
            // Path doesn't exist, continue
          }
        }
        
        if (skillName) {
          // Load specific skill
          for (const skillPath of skillPaths) {
            const skillFile = path.join(skillPath, skillName, "SKILL.md");
            try {
              const content = await fs.readFile(skillFile, "utf-8");
              skillsContent = `\n=== SKILL: ${skillName} ===\n${content}\n========================\n`;
              break;
            } catch {
              continue;
            }
          }
          if (!skillsContent) {
            skillsContent = `Skill '${skillName}' not found. Available skills: ${availableSkills.map(s => s.name).join(", ") || "none"}`;
          }
        } else {
          // List all skills
          skillsContent = `Available Skills:\n${availableSkills.map(s => `- ${s.name} (from ${s.source})`).join("\n") || "No skills found"}`;
        }
        
        return {
          messages: [{
            role: "user",
            content: { type: "text", text: skillsContent }
          }]
        };
      }
      
      case "task-planner": {
        const task = a?.task || "Unknown task";
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `Plan this task using sequential_thinking and todo_write:

${task}

Break it down into:
1. Understanding phase (read files, search codebase)
2. Analysis phase (identify issues, plan approach)
3. Implementation phase (make changes step by step)
4. Verification phase (test, review, commit)

Use sequential_thinking for each major decision.
Track progress with todo_write.`
            }
          }]
        };
      }
      
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  } catch (e: any) {
    throw new Error(`Failed to get prompt '${name}': ${e.message}`);
  }
});

async function main() {
  console.error("🌐 qwen-core v2.0.0 starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Ready - 40 tools + 3 prompts loaded");
  console.error("📦 Categories: File (15), Search (2), Web (2), Git (5), Time (2), PDF (1), System (3), Skills (3), Agent (7)");
  console.error("🧠 Prompts: autonomous-agent, skill-loader, task-planner");
  console.error("📁 Skills auto-load from: ~/.agents/skills/, ./skills/, ./.qwen/skills/");
}

main().catch(e => { 
  console.error("💥 Fatal error:", e); 
  process.exit(1); 
});
