# qwen-core

![Version](https://img.shields.io/npm/v/qwen-core?label=Version&color=blue)
![License](https://img.shields.io/npm/l/qwen-core?color=green)
![Platform](https://img.shields.io/badge/Platform-Node.js%2018%2B%20%7C%20TypeScript-blue)
![Tools](https://img.shields.io/badge/Tools-28-red)
![Prompts](https://img.shields.io/badge/Prompts-3-purple)

**All-in-One MCP Server** — 28 tools + 3 prompts for autonomous AI agents.

https://www.npmjs.com/package/qwen-core

---

## 🚀 Quick Start

### 1. Install

```bash
npm install -g qwen-core
```

### 2. Configure Your MCP Client

Add to your MCP config:

```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["-y", "qwen-core"]
    }
  }
}
```

### 3. Done

That's it. No `cwd`, no env vars needed. Defaults handle everything.

---

## 📦 Installation Options

### Global (Recommended)

```bash
npm install -g qwen-core
```

Use with: `npx -y qwen-core`

### Local

```bash
npm install qwen-core
```

Use with: `npx -y qwen-core` (npx finds it locally)

### From Source

```bash
git clone https://github.com/youssefvdel/qwen-core.git
cd qwen-core
npm install
npx tsx src/index.ts
```

---

## 🔧 Configuration

### Minimal Config

```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["-y", "qwen-core"]
    }
  }
}
```

### With Environment Variables (Optional)

```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["-y", "qwen-core"],
      "env": {
        "MCP_ALLOWED_DIRS": "/home/user,/home/user/Projects,/tmp",
        "MCP_TIMEOUT": "60000"
      }
    }
  }
}
```

| Variable | Purpose | Default |
|----------|---------|---------|
| `MCP_ALLOWED_DIRS` | Restrict file operations to directories | `~`, `~/Projects`, `/tmp` |
| `MCP_TIMEOUT` | Global timeout cap (ms) | `60000` |

---

## 🧠 Smart Defaults

### Dynamic Timeout

Each operation gets a smart timeout based on type and complexity:

| Operation | Base Timeout | Factors |
|-----------|-------------|---------|
| File read/write | 5s | Content size (1x–3x) |
| File edit | 5s | Content size (1x–3x) |
| Bash (quick: `ls`, `cat`) | 7.5s | Command type |
| Bash (build: `npm run build`) | 45s | Command type |
| Bash (install: `npm install`) | 60s | Command type |
| Bash (test: `npm test`) | 30s | Command type |
| Grep search | 15s | Search depth (1x–3x) |
| Glob search | 10s | Recursive (1x–3x) |
| Web fetch | 15s | URL type (1x–3x) |
| Git operations | 20s | Fixed |

### Path Validation

File operations are restricted to allowed directories by default:

- Home directory (`~`)
- `~/Projects`
- `/tmp`

Prevents accidental system file modification.

---

## 🛠️ Tool Categories

| Category | Count | Key Tools |
|----------|-------|-----------|
| **File** | 8 | `read_file`, `write_file`, `edit_file`, `list_directory`, `create_directory`, `delete_file`, `move_file`, `delete_directory` |
| **File Extended** | 3 | `read_text_file`, `read_multiple_files`, `read_pdf` |
| **Search** | 2 | `glob_search`, `grep_search` |
| **Time** | 2 | `get_current_time`, `convert_time` |
| **System** | 1 | `bash` |
| **Agent** | 3 | `sequential_thinking`, `todo_write`, `autonomous_agent` |
| **Skills** | 3 | `list_skills`, `load_skill`, `skill_info` |
| **Memory** | 2 | `error_memory_status`, `clear_error_memory` |
| **Core** | 4 | `bash_execute`, `file_read`, `file_write`, `file_edit` |

---

## 🧠 Prompt Templates

### `autonomous-agent`

Teaches the model the Think → Plan → Act → Observe → Correct cycle.

### `skill-loader`

Loads skills from `~/.agents/skills/`, `./skills/`, or `./.qwen/skills/`.

### `task-planner`

Breaks complex tasks into sequential steps.

---

## 📁 Skills System

Skills auto-load from:

1. `~/.agents/skills/{name}/SKILL.md` — Global
2. `./skills/{name}/SKILL.md` — Project
3. `./.qwen/skills/{name}/SKILL.md` — Alternative

### Creating a Skill

Create `skills/my-skill/SKILL.md`:

```markdown
name: my-skill
description: "What this skill does"
triggers: ["keyword1", "keyword2"]

## Instructions
- Step 1
- Step 2
```

---

## 🔄 Autonomous Agent Protocol

```
1. THINK  →  sequential_thinking: "Analyzing the problem..."
2. PLAN   →  todo_write: [{ content: "Step 1", status: "pending" }]
3. ACT    →  read_file, edit_file, bash, etc.
4. OBSERVE →  Verify results
5. CORRECT →  Fix errors, retry
```

---

## 📋 Rules Engine

Create `.qwenrules` in your project root:

```text
# Coding standards
Always use TypeScript strict mode
No console.log in production code

# Security
Never commit .env files
```

---

## 🧪 Development

```bash
# Clone
git clone https://github.com/youssefvdel/qwen-core.git
cd qwen-core

# Install
npm install

# Run
npx tsx src/index.ts

# Type check
npx tsc --noEmit
```

---

## 📊 Example Usage

### Bug Fix Flow

```
User: "Fix the authentication bug"

Agent:
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

---

## 🏗️ Architecture

```
qwen-core/
├── src/
│   ├── index.ts              # Main server (tools + prompts)
│   ├── tools/                # Tool implementations
│   │   ├── BaseTool.ts       # Base class with validation
│   │   ├── BashTool.ts       # Dynamic timeout
│   │   ├── FileReadTool.ts   # Path validation
│   │   └── ...
│   ├── utils/
│   │   ├── PathValidator.ts  # MCP_ALLOWED_DIRS enforcement
│   │   └── TimeoutEstimator.ts # Smart timeout calculation
│   └── agent/                # Agent infrastructure
├── skills/                   # Skill definitions
└── package.json
```

---

## 🔒 Safety Features

- Path validation restricts file operations to allowed directories
- Dynamic timeouts prevent hung operations
- Read-before-edit verification
- Dangerous command detection (`rm -rf /`, fork bombs, etc.)
- Error isolation and recovery

---

## 📈 Performance

- Dynamic timeout estimation per operation
- Smart search fallbacks (ripgrep → grep)
- Efficient file operations with size-based timeouts
- Optimized PDF parsing

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feat/new-tool`
3. Implement and test
4. Run typecheck: `npx tsc --noEmit`
5. Submit PR

---

## 📄 License

MIT License — See LICENSE file

---

## 🙏 Credits

Built with:

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- [simple-git](https://github.com/steveukx/git-js)
- [pdf-parse](https://www.npmjs.com/package/pdf-parse)
- [execa](https://github.com/sindresorhus/execa)
- [fast-glob](https://github.com/mrmlnc/fast-glob)
- [zod](https://github.com/colinhacks/zod)

---

**qwen-core** — Making AI agents truly autonomous 🚀
