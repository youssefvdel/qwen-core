# qwen-core

> Autonomous Engineering Agent — Built for Youssef. Powered by Qwen.

[![MCP](https://img.shields.io/badge/MCP-Server-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What is qwen-core?

**qwen-core** is a Model Context Protocol (MCP) server that transforms Qwen into a fully autonomous engineering agent. It provides native tool execution, advanced reasoning, and Claude Code-style skills — all running locally on your machine.

### Key Features

| Feature | Description |
|---------|-------------|
| **11 Native Tools** | `bash`, `file_read/write/edit`, `glob/grep_search`, `web_fetch/search`, `todo_write`, `ask_user`, `sequential_thinking` |
| **ReAct Agent Loop** | Think → Act → Observe → Reflect → Repeat |
| **Rules Engine** | `.qwenrules` file for project-specific constraints |
| **Skills System** | Load Claude Code-style skills from `~/.agents/` |
| **Permission System** | Safety checks before destructive operations |
| **Session Management** | Conversation persistence across restarts |
| **Abort Support** | Cancel tasks mid-execution |

---

## Quick Start

### Prerequisites
- Node.js 18+ or Bun
- `tsx` for TypeScript execution
- `ripgrep` (optional, for `grep_search` tool)

### Installation
```bash
cd ~/Projects/qwen-core
npm install
```

### Run as MCP Server
```bash
npx tsx src/index.ts
```

### Add to Qwen Desktop
Paste this into **Settings → My MCP → Add MCP**:

```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["--yes", "tsx", "/home/youssefvdel/Projects/qwen-core/src/index.ts"],
      "env": { "PATH": "/usr/local/bin:/usr/bin:/bin" }
    }
  }
}
```

**Restart Qwen Desktop** and start using tools naturally:
```
You: "List all TypeScript files in this project"
Qwen → calls glob_search → returns results
```

---

## Available Tools

### File Operations
| Tool | Parameters | Description |
|------|-----------|-------------|
| `file_read` | `path: string` | Read file contents |
| `file_write` | `path, content: string` | Write/overwrite file |
| `file_edit` | `path, oldText, newText: string` | Search & replace in file |

### Search & Discovery
| Tool | Parameters | Description |
|------|-----------|-------------|
| `glob_search` | `pattern, cwd?: string` | Find files by glob pattern |
| `grep_search` | `pattern, path?, caseSensitive?` | Search content with ripgrep |

### Shell & Execution
| Tool | Parameters | Description |
|------|-----------|-------------|
| `bash_execute` | `command, cwd?: string` | Run shell command (30s timeout) |

### Web Access
| Tool | Parameters | Description |
|------|-----------|-------------|
| `web_fetch` | `url: string` | Fetch any URL content |
| `web_search` | `query, numResults?` | DuckDuckGo web search |

### Agent & Interaction
| Tool | Parameters | Description |
|------|-----------|-------------|
| `sequential_thinking` | `thought, step, total` | Log reasoning steps |
| `todo_write` | `todos: Array<{content, status}>` | Manage task lists |
| `ask_user` | `question: string` | Prompt for user input |

---

## Rules Engine (`.qwenrules`)

Create a `.qwenrules` file in your project root to enforce coding standards:

```text
# .qwenrules
# Comments start with #

# Style rules
Always use TypeScript strict mode.
No console.log in production code.
Prefer async/await over promises.

# Security rules
Never commit .env files.
Sanitize all user inputs.

# Workflow rules
Run tests before committing.
Use conventional commits.
```

Rules are auto-injected into every agent request.

---

## Skills System

Load specialized instruction sets from `~/.agents/`:

```bash
# List available skills
/list_skills

# Load a skill
/load_skill { "name": "tdd" }

# Get skill info
/skill_info { "name": "git" }
```

### Example: `tdd` Skill
```yaml
# ~/.agents/skills/tdd/SKILL.md
name: tdd
description: "Test-Driven Development expert"
instructions: |
  - Write tests before implementation
  - Use AAA pattern (Arrange-Act-Assert)
  - Keep tests isolated and fast
  - Refactor only when tests pass
```

---

## Architecture

```
qwen-core/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── agent/
│   │   ├── QueryEngine.ts    # ReAct loop implementation
│   │   ├── PermissionSystem.ts # Safety checks
│   │   └── SessionManager.ts  # Conversation persistence
│   ├── tools/
│   │   ├── BashTool.ts       # Shell execution
│   │   ├── FileReadTool.ts   # File operations
│   │   ├── GrepTool.ts       # Content search
│   │   └── ...               # All 11 tools
│   └── system/
│       ├── RulesEngine.ts    # .qwenrules parser
│       └── SkillLoader.ts    # ~.agents/ integration
├── skills/                   # Local skill definitions
├── .qwenrules               # Project rules
├── package.json
└── README.md
```

### Agent Loop Flow
```
1. User sends message
2. QueryEngine injects: system prompt + rules + skills
3. LLM decides: respond or call tool
4. If tool: execute → capture result → feed back to LLM
5. Loop until final answer or max iterations (15)
6. Return response to user
```

---

## Development

### Project Structure
```bash
npm install -D tsx @types/node
npx tsx --watch src/index.ts
npx tsc --noEmit
```

### Adding a New Tool
1. Create `src/tools/MyNewTool.ts`
2. Implement the tool logic with Zod schema
3. Register in `src/index.ts`:
```typescript
server.tool("my_new_tool", {
  param: z.string()
}, async ({ param }) => {
  return { content: [{ type: "text", text: "Result" }] };
});
```

### Testing
```bash
echo '{"method":"tools/list"}' | npx tsx src/index.ts
npx @modelcontextprotocol/inspector
```

---

## MCP Integration

### Transport: Stdio
qwen-core uses **stdio transport** for maximum compatibility:
- Works with any MCP client
- No network overhead
- Secure (local process only)

### Message Format
```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "bash_execute",
    "arguments": { "command": "ls -la" }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "total 48\n..." }]
  }
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-tool`
3. Implement + test your changes
4. Run `npm run lint` and `npm run typecheck`
5. Submit a PR with clear description

### Code Style
- TypeScript strict mode
- ESLint + Prettier config coming soon
- JSDoc for public APIs
- Meaningful commit messages (conventional commits)

---

## License

MIT © 2026 Youssef. Built for the top 0.1% engineer journey.

---

> **Pro Tip**: Use `sequential_thinking` for complex tasks. It helps the agent plan before acting, reducing errors and improving output quality.
