# qwen-core v2.0

![Version](https://img.shields.io/github/package-json/v/youssefvdel/qwen-core?label=Version&color=blue)
![License](https://img.shields.io/github/license/youssefvdel/qwen-core?color=green)
![Platform](https://img.shields.io/badge/Platform-Node.js%2018%2B%20%7C%20TypeScript-blue)
![Tools](https://img.shields.io/badge/Tools-21%2B-red)
![Prompts](https://img.shields.io/badge/Prompts-3-purple)

**Autonomous AI Agent MCP Server** - Enhanced with 21 tools, 3 prompts, and auto-loading skills for self-directed task completion.

## 🚀 Overview

qwen-core transforms AI assistants into **autonomous agents** that can:
- 🧠 **Think** before acting using structured reasoning
- 📋 **Plan** complex tasks with todo tracking
- 🔧 **Act** using 21 specialized tools
- 👁️ **Observe** and verify results
- 🔄 **Correct** themselves when errors occur

## ✨ New in v2.0

### Autonomous Agent System
- **3 Prompt Templates**: Pre-built system prompts for agent behavior
- **Auto-Loading Skills**: Skills from `~/.agents/skills/`, `./skills/`, `./.qwen/skills/`
- **Self-Correction Protocol**: Built-in error recovery patterns
- **Sequential Thinking**: Structured reasoning steps

### New Tools (10 Added)
| Category | Tools |
|----------|-------|
| **Git** | `git_status`, `git_diff`, `git_commit`, `git_add`, `git_log` |
| **Time** | `get_current_time`, `convert_time` |
| **PDF** | `read_pdf` |
| **Enhanced** | Improved `bash`, `edit_file`, `grep_search` |

### Skills System
Pre-built skills included:
- `autonomous-agent` - Core agent behavior (auto-loaded)
- `tdd` - Test-Driven Development workflow
- `git` - Git best practices
- `security-review` - Security auditing

## 📦 Installation

```bash
git clone https://github.com/youssefvdel/qwen-core.git
cd qwen-core
npm install
```

## 🔧 Configuration

### Claude Desktop
```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/qwen-core"
    }
  }
}
```

### VS Code
```json
{
  "mcp": {
    "servers": {
      "qwen-core": {
        "command": "npx",
        "args": ["tsx", "src/index.ts"]
      }
    }
  }
}
```

## 🛠️ Available Tools (21)

### File Operations (4)
| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with encoding support |
| `write_file` | Create/overwrite files (auto-creates directories) |
| `edit_file` | Search-replace with `replaceAll` option |
| `glob_search` | Find files by glob pattern |

### Search & Discovery (2)
| Tool | Description |
|------|-------------|
| `grep_search` | Search content with regex (ripgrep/grep) |
| `glob_search` | Pattern-based file discovery |

### Shell & Web (3)
| Tool | Description |
|------|-------------|
| `bash` | Execute commands with timeout/cwd |
| `web_fetch` | Fetch URLs and extract content |
| `web_search` | DuckDuckGo web search |

### Git Operations (5) 🆕
| Tool | Description |
|------|-------------|
| `git_status` | Show working tree status |
| `git_diff` | Show staged/unstaged/compare diffs |
| `git_commit` | Commit with message |
| `git_add` | Stage files |
| `git_log` | View commit history |

### Time Operations (2) 🆕
| Tool | Description |
|------|-------------|
| `get_current_time` | Get time in specific timezone |
| `convert_time` | Convert between timezones |

### PDF Processing (1) 🆕
| Tool | Description |
|------|-------------|
| `read_pdf` | Extract text, metadata, images from PDFs |

### Agent & Interaction (4)
| Tool | Description |
|------|-------------|
| `todo_write` | Manage task lists with statuses |
| `ask_user` | Prompt for user input |
| `sequential_thinking` | Structured reasoning steps |
| `bash` | System commands |

### Skills System (3)
| Tool | Description |
|------|-------------|
| `list_skills` | List installed skills |
| `load_skill` | Load skill instructions |
| `skill_info` | Get skill metadata |

## 🧠 Prompt Templates (3)

### `autonomous-agent`
System prompt that teaches the model:
- Think-Plan-Act-Observe-Correct cycle
- Tool usage patterns
- Error recovery
- Safety rules

**Usage**: Automatically applied or via `/prompt autonomous-agent`

### `skill-loader`
Loads skills from:
- `~/.agents/skills/{name}/SKILL.md`
- `./skills/{name}/SKILL.md`
- `./.qwen/skills/{name}/SKILL.md`

**Usage**: `/prompt skill-loader {"skillName": "tdd"}`

### `task-planner`
Breaks down complex tasks into sequential steps.

**Usage**: `/prompt task-planner {"task": "Refactor auth module"}`

## 📁 Skills System

### Folder Structure
```
qwen-core/
├── skills/                    # Project-specific skills
│   ├── autonomous-agent/
│   │   └── SKILL.md          # Auto-loaded agent behavior
│   ├── tdd/
│   │   └── SKILL.md          # TDD workflow
│   ├── git/
│   │   └── SKILL.md          # Git best practices
│   └── security-review/
│       └── SKILL.md          # Security auditing
└── .qwenrules                 # Project rules
```

### Auto-Load Locations
1. `~/.agents/skills/` - Global Claude Code skills
2. `./skills/` - Project-specific skills
3. `./.qwen/skills/` - Alternative project skills

### Creating Skills
```markdown
name: my-skill
description: "What this skill does"
triggers: ["keyword1", "keyword2"]

## Instructions
- Step 1
- Step 2
- Step 3

## Examples
Example usage here
```

## 🔄 Autonomous Agent Protocol

### 1. THINK
```
sequential_thinking: "I need to understand the codebase first"
```

### 2. PLAN
```
todo_write: [
  {content: "Read main module", status: "pending"},
  {content: "Identify issues", status: "pending"},
  {content: "Fix bugs", status: "pending"},
  {content: "Test changes", status: "pending"}
]
```

### 3. ACT
```
glob_search: "**/*.ts"
read_file: "src/main.ts"
```

### 4. OBSERVE
```
Check results, verify correctness
```

### 5. CORRECT
```
If error: Analyze → Adjust → Retry → Verify
```

## 📋 Rules Engine

Create `.qwenrules` in project root:
```text
# Coding standards
Always use TypeScript strict mode
No console.log in production code

# Security
Never commit .env files
Sanitize all user inputs

# Workflow
Run tests before committing
Use conventional commits
```

## 🧪 Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Type check
npm run typecheck

# Start server
npm start
```

## 📊 Example Usage

### Autonomous Bug Fix
```
User: "Fix the authentication bug"

Agent Flow:
1. sequential_thinking: "Let me find the auth module"
2. glob_search: "**/*auth*.ts"
3. read_file: "src/auth.ts"
4. grep_search: "TODO|FIXME|BUG"
5. sequential_thinking: "Found null check missing"
6. edit_file: Add null check
7. read_file: Verify fix
8. git_diff: Review changes
9. git_add + git_commit: Commit
10. Report completion
```

### Using Skills
```
User: "Add tests for the new feature"

Agent:
1. load_skill: {"name": "tdd"}
2. Follows TDD workflow:
   - Write failing test
   - Make it pass
   - Refactor
```

## 🏗️ Architecture

```
qwen-core/
├── src/
│   ├── index.ts              # Main server (tools + prompts)
│   ├── agent/
│   │   ├── ToolRegistry.ts   # Tool management
│   │   └── SessionManager.ts # Session persistence
│   └── tools/                # Individual tool implementations
├── skills/                   # Skill definitions
│   ├── autonomous-agent/
│   ├── tdd/
│   ├── git/
│   └── security-review/
├── .qwenrules               # Project rules
└── package.json
```

## 🔒 Safety Features

- Read-before-edit verification
- Git diff review before commits
- Timeout on bash commands (30s default)
- Error isolation and recovery
- User confirmation for destructive ops

## 📈 Performance

- Parallel tool execution support
- Efficient file caching
- Smart search fallbacks (ripgrep → grep)
- Optimized PDF parsing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feat/new-tool`
3. Implement and test
4. Run typecheck: `npm run typecheck`
5. Submit PR

## 📄 License

MIT License - See LICENSE file

## 🙏 Credits

Built with:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- [simple-git](https://github.com/steveukx/git-js)
- [pdf-parse](https://www.npmjs.com/package/pdf-parse)
- [execa](https://github.com/sindresorhus/execa)

---

**qwen-core v2.0** - Making AI agents truly autonomous 🚀
