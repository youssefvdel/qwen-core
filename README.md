# qwen-core

![Version](https://img.shields.io/github/package-json/v/youssefvdel/qwen-core?label=Version&color=blue)
![License](https://img.shields.io/github/license/youssefvdel/qwen-core?color=green)
![Platform](https://img.shields.io/badge/Platform-Node.js%2018%2B%20%7C%20TypeScript-blue)
![Stars](https://img.shields.io/github/stars/youssefvdel/qwen-core?style=social)

A high-performance Model Context Protocol (MCP) server that enables autonomous, tool-driven AI assistance for software development.

## Overview

qwen-core transforms Qwen Desktop into a fully agentic coding assistant by providing native tool execution, structured reasoning, and extensible skill definitions. It is designed for developers who need reliable, automated workflows that act first and explain later.

## Features

- **Autonomous Agent Loop**: Implements a ReAct-style cycle (Think → Act → Observe → Reflect) for self-directed task completion
- **11 Native Tools**: File I/O, shell execution, content search, web access, and structured reasoning capabilities
- **Claude Code Skills Integration**: Load specialized instruction sets from `~/.agents/` for domain-specific workflows
- **Rules Engine**: Enforce project-specific coding standards via a `.qwenrules` configuration file
- **Self-Healing Execution**: Automatic error detection, retry logic, and fallback strategies
- **Standard MCP Compliance**: Uses stdio transport for maximum compatibility with MCP clients

## Installation

```bash
git clone https://github.com/youssefvdel/qwen-core.git
cd qwen-core
npm install
```

## Requirements

- Node.js 18+ or Bun
- `npx` (for `tsx` execution)
- `ripgrep` (optional, required for `grep_search` tool)

## Configuration

Add the following to your MCP client configuration (e.g., Qwen Desktop settings):

```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["--yes", "tsx", "<PATH_TO_QWEN_CORE>/src/index.ts"],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

Replace `<PATH_TO_QWEN_CORE>` with the absolute path to your cloned repository.

## Available Tools

### File Operations
| Tool | Parameters | Description |
|------|-----------|-------------|
| `file_read` | `path: string` | Read file contents with UTF-8 encoding |
| `file_write` | `path: string, content: string` | Create or overwrite a file |
| `file_edit` | `path: string, oldText: string, newText: string` | Perform search-and-replace in a file |

### Search & Discovery
| Tool | Parameters | Description |
|------|-----------|-------------|
| `glob_search` | `pattern: string, cwd?: string` | Find files matching a glob pattern |
| `grep_search` | `pattern: string, path?: string, caseSensitive?: boolean` | Search file contents using ripgrep |

### Shell Execution
| Tool | Parameters | Description |
|------|-----------|-------------|
| `bash_execute` | `command: string, cwd?: string` | Execute a shell command (30 second timeout) |

### Web Access
| Tool | Parameters | Description |
|------|-----------|-------------|
| `web_fetch` | `url: string` | Retrieve raw content from a URL |
| `web_search` | `query: string, numResults?: number` | Perform web searches via DuckDuckGo API |

### Agent & Interaction
| Tool | Parameters | Description |
|------|-----------|-------------|
| `sequential_thinking` | `thought: string, step: number, total: number` | Log structured reasoning steps |
| `todo_write` | `todos: Array<{content: string, status: string}>` | Manage structured task lists |
| `ask_user` | `question: string` | Prompt for user input during execution |

## Usage Examples

Once connected to an MCP client, qwen-core automatically registers all tools. Example interactions:

```
User: List all TypeScript files in the current directory
Agent: Calls glob_search(pattern="**/*.ts") → Returns file list

User: Read the contents of package.json
Agent: Calls file_read(path="./package.json") → Returns file content

User: Search for TODO comments across the codebase
Agent: Calls grep_search(pattern="TODO") → Returns matching lines
```

## Rules Engine

Create a `.qwenrules` file in your project root to enforce coding standards and workflow constraints:

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

Rules are automatically injected into every agent request.

## Skills System

qwen-core supports loading specialized instruction sets from the `~/.agents/` directory:

```bash
# List available skills
/list_skills

# Load a skill
/load_skill { "name": "tdd" }

# Get skill metadata
/skill_info { "name": "git" }
```

### Example Skill Definition

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

### Agent Execution Flow

1. User sends a message or task
2. QueryEngine injects system prompt, active rules, and loaded skills
3. LLM decides whether to respond directly or call a tool
4. If a tool is called: execute → capture result → feed back to LLM
5. Loop continues until a final answer is produced or max iterations (15) is reached
6. Response is returned to the user

## Development

### Project Setup

```bash
npm install -D tsx @types/node
npx tsx --watch src/index.ts
npx tsc --noEmit
```

### Adding a New Tool

1. Create `src/tools/MyNewTool.ts`
2. Implement the tool logic with a Zod schema for input validation
3. Register the tool in `src/index.ts`:

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

## MCP Integration

### Transport: Stdio

qwen-core uses stdio transport for maximum compatibility:
- Works with any MCP-compliant client
- No network overhead or configuration
- Secure execution (local process only)

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

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-tool`
3. Implement and test your changes
4. Run type checking: `npx tsc --noEmit`
5. Submit a pull request with a clear description of changes

### Code Style

- TypeScript strict mode enabled
- JSDoc comments for public APIs
- Meaningful commit messages (conventional commits recommended)

## License

MIT License. See LICENSE file for details.

Copyright (c) 2026 qwen-core contributors
