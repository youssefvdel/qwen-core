# qwen-core Tools Reference

**Total Tools:** 28  
**Categories:** 8 (file, search, time, system, pdf, agent, skills, core)

---

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| `file` | 10 | Read, write, edit, list, create, delete, move files |
| `search` | 2 | Find files by pattern (glob) or content (grep) |
| `time` | 2 | Get current time, convert between timezones |
| `system` | 1 | Execute shell commands (bash) |
| `pdf` | 1 | Extract text and metadata from PDF files |
| `agent` | 5 | Autonomous agent, error memory, todo tracking, sequential thinking |
| `skills` | 3 | List, load, and get info about installed skills |
| `core` | 4 | Core file operations (bash_execute, file_read, file_write, file_edit) |

---

## File Category (10 tools)

### `read_file`
Read complete file contents with UTF-8 encoding.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Absolute or relative file path to read |
| `encoding` | string | No | File encoding (default: utf-8) |

**Example:**
```json
{ "path": "src/index.ts" }
```

**Use Cases:**
- Read source code before editing
- Read config files (package.json, tsconfig.json)
- Read documentation (README.md)
- Verify changes after edit

---

### `write_file`
Create new file or overwrite existing file completely.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to create or overwrite |
| `content` | string | Yes | Complete file content to write |

**Example:**
```json
{ "path": "src/new.ts", "content": "export const x = 1;" }
```

**Use Cases:**
- Creating new files from scratch
- Regenerating generated code
- Replacing entire file content
- Writing configuration files

---

### `edit_file`
Search and replace text in a file with optional multiple replacements.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to edit |
| `oldText` | string | Yes | Exact text to find (include context for unique match) |
| `newText` | string | Yes | Replacement text (preserve formatting) |
| `replaceAll` | boolean | No | Replace all occurrences (default: false) |

**Example:**
```json
{ "path": "src.ts", "oldText": "const x = 1", "newText": "const x = 2" }
```

**Use Cases:**
- Fixing bugs in existing code
- Renaming variables/functions
- Updating imports
- Changing configuration values
- Fixing typos across files

---

### `list_directory`
List directory contents with [FILE] or [DIR] prefixes.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Directory path to list (use '.' for current directory) |

**Example:**
```json
{ "path": "src/components" }
```

**Output Format:**
```
[DIR] src
[DIR] tests
[FILE] package.json
[FILE] README.md
```

---

### `create_directory`
Create new directory or ensure it exists (creates parents if needed).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Directory path to create (parents created automatically) |

**Example:**
```json
{ "path": "src/components/buttons" }
```

---

### `delete_file`
Delete a file permanently.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to delete |

**Example:**
```json
{ "path": "temp.txt" }
```

**⚠️ Caution:** PERMANENT - cannot be undone

---

### `delete_directory`
Delete a directory and its contents.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Directory path to delete |
| `recursive` | boolean | No | Delete recursively (default: true) |

**Example:**
```json
{ "path": "temp-folder", "recursive": true }
```

**⚠️ Caution:** PERMANENT - deletes ALL contents recursively

---

### `move_file`
Move or rename files and directories.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | string | Yes | Source file or directory path |
| `destination` | string | Yes | Destination path (must have existing parent directory) |

**Example:**
```json
{ "source": "old-name.txt", "destination": "new-name.txt" }
```

---

### `read_text_file`
Read complete file contents as text with optional line limits.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to read |
| `head` | number | No | Read only first N lines (e.g., 50) |
| `tail` | number | No | Read only last N lines (e.g., 20) |

**Example:**
```json
{ "path": "large.log", "tail": 20 }
```

---

### `read_multiple_files`
Read multiple files simultaneously in a single call.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paths` | string[] | Yes | Array of file paths to read |

**Example:**
```json
{ "paths": ["src/index.ts", "src/utils.ts", "src/types.ts"] }
```

**Output Format:**
```
=== /path/to/file1.ts ===
<file content>

=== /path/to/file2.ts ===
<file content>
```

---

## Search Category (2 tools)

### `glob_search`
Find files by glob pattern with working directory support.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | string | Yes | Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx') |
| `cwd` | string | No | Working directory for search |
| `absolute` | boolean | No | Return absolute paths (default: false) |

**Example:**
```json
{ "pattern": "**/*.test.ts", "cwd": "/project", "absolute": true }
```

**Glob Pattern Syntax:**
- `*` = any characters except `/`
- `**` = any characters including `/` (recursive)
- `?` = single character
- `{a,b}` = match a or b
- `!` = negate pattern

**Common Patterns:**
- `**/*.ts` - all TypeScript files
- `src/**/*.tsx` - TSX files in src
- `**/*.test.{ts,js}` - all test files
- `**/README.md` - all README files

---

### `grep_search`
Search file contents using ripgrep (rg) or grep with regex support.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | string | Yes | Regex pattern to search for |
| `path` | string | No | Directory to search (default: .) |
| `caseSensitive` | boolean | No | Case sensitive search (default: false) |
| `filePattern` | string | No | File glob filter (e.g., '*.ts', '*.tsx') |

**Example:**
```json
{ "pattern": "function getUser", "filePattern": "*.ts", "caseSensitive": true }
```

**Common Regex Patterns:**
- `function\s+\w+` - function declarations
- `import\s+\{.*\}\s+from` - named imports
- `class\s+\w+\s+extends` - class inheritance
- `TODO|FIXME|XXX` - code markers
- `\berror\b` - exact word match

---

## Time Category (2 tools)

### `get_current_time`
Get current time in a specific timezone.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `timezone` | string | Yes | IANA timezone name (e.g., 'America/New_York', 'UTC', 'Asia/Tokyo') |

**Example:**
```json
{ "timezone": "America/New_York" }
```

**Common Timezones:**
- `America/New_York` - Eastern Time (ET)
- `America/Los_Angeles` - Pacific Time (PT)
- `Europe/London` - GMT/BST
- `Europe/Paris` - Central European Time
- `Asia/Tokyo` - Japan Standard Time
- `Asia/Shanghai` - China Standard Time
- `UTC` - Coordinated Universal Time

---

### `convert_time`
Convert time between timezones.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sourceTimezone` | string | Yes | Source IANA timezone (e.g., 'America/New_York') |
| `time` | string | Yes | Time in HH:MM 24-hour format (e.g., '14:00', '09:30') |
| `targetTimezone` | string | Yes | Target IANA timezone (e.g., 'Europe/London') |

**Example:**
```json
{ "sourceTimezone": "America/New_York", "time": "14:00", "targetTimezone": "Europe/London" }
```

---

## System Category (1 tool)

### `bash`
Execute shell commands with timeout and working directory support.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | Shell command to execute |
| `cwd` | string | No | Working directory for command execution |
| `timeout` | number | No | Timeout in milliseconds (default: 30000) |

**Example:**
```json
{ "command": "npm run build", "cwd": "/path/to/project", "timeout": 60000 }
```

**Common Commands:**
- `npm install`, `npm run build`, `npm test`
- `git add .`, `git commit -m 'msg'`, `git push`
- `ls -la`, `cat file.txt`, `grep pattern file`
- `docker build -t app .`, `docker-compose up`

---

## PDF Category (1 tool)

### `read_pdf`
Extract text, metadata, and images from PDF files.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Path to PDF file |
| `pages` | string | No | Pages to extract (e.g., '1-5,10' or '1,3,7-10') |
| `includeText` | boolean | No | Extract text content (default: true) |
| `includeMetadata` | boolean | No | Extract metadata (default: true) |
| `includeImages` | boolean | No | Extract images (default: false) |

**Example:**
```json
{ "path": "document.pdf", "pages": "1-5", "includeMetadata": true }
```

---

## Agent Category (5 tools)

### `sequential_thinking` ⭐ PRIMARY TOOL
**MANDATORY:** Always call this BEFORE using any other action tool.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `thought` | string | Yes | Your current thinking step |
| `nextThoughtNeeded` | boolean | Yes | Whether another thought is needed |
| `thoughtNumber` | number | Yes | Current thought number (starts at 1) |
| `totalThoughts` | number | Yes | Estimated total thoughts (adjustable) |
| `isRevision` | boolean | No | Whether this revises previous thinking |
| `revisesThought` | number | No | Which thought number is being reconsidered |
| `branchFromThought` | number | No | Thought number to branch from |
| `branchId` | string | No | Identifier for this branch (e.g., 'alt-1') |
| `needsMoreThoughts` | boolean | No | If more thoughts needed than totalThoughts |

**Example:**
```json
{
  "thought": "I need to find the auth module first. I'll use glob_search.",
  "thoughtNumber": 1,
  "totalThoughts": 3,
  "nextThoughtNeeded": true
}
```

**Think-First Rule:**
1. Call `sequential_thinking` with your analysis
2. Break down what you need to do step by step
3. Confirm you understand which tool to use and why
4. Only THEN call the actual tool

---

### `todo_write`
Manage a structured todo list for tracking task progress.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `todos` | object[] | Yes | Array of todo items |

**Todo Item Schema:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | string | Yes | Task description |
| `status` | string | Yes | `pending`, `in_progress`, or `done` |

**Example:**
```json
{
  "todos": [
    { "content": "Read codebase", "status": "pending" },
    { "content": "Implement feature", "status": "pending" },
    { "content": "Write tests", "status": "pending" }
  ]
}
```

**Status Values:**
- `pending` - not started
- `in_progress` - currently working on
- `done` - completed

---

### `autonomous_agent`
Execute development tasks autonomously with build, test, and fix cycles.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task` | string | Yes | Task to execute (e.g., 'Fix failing tests', 'Debug build error') |
| `workspaceRoot` | string | No | Working directory (default: current directory) |
| `buildCommand` | string | No | Build command (default: 'npm run build') |
| `testCommand` | string | No | Test command (default: 'npm test') |
| `maxIterations` | number | No | Max fix attempts (default: 10, max: 50) |

**Example:**
```json
{ "task": "Fix failing unit tests in src/", "maxIterations": 20 }
```

**How It Works:**
1. **PLAN:** Analyzes task and creates approach
2. **BUILD:** Runs build command, captures errors
3. **TEST:** Runs test command, captures failures
4. **FIX:** Attempts to fix detected errors
5. **MEMORY:** Remembers failed fixes to avoid repetition
6. **REPEAT:** Continues until success or max iterations

---

### `error_memory_status`
Get summary of learned errors and fixes from autonomous agent.

**Parameters:** None

**Example:**
```json
{}
```

**Returns:**
- Total errors tracked
- Number of errors fixed
- Number of unresolved errors
- Summary of learnings from past attempts

---

### `clear_error_memory`
Clear all error memory (removes learned lessons from autonomous agent).

**Parameters:** None

**Example:**
```json
{}
```

**⚠️ Caution:** All learned lessons will be lost

---

## Skills Category (3 tools)

### `list_skills`
List all installed Claude Code skills from ~/.agents/skills/.

**Parameters:** None

**Example:**
```json
{}
```

**Returns:**
- Skill name
- Source location
- Hash (first 8 chars)

**Skill Locations:**
1. `~/.agents/skills/{name}/SKILL.md` - Global skills
2. `./skills/{name}/SKILL.md` - Project skills
3. `./.qwen/skills/{name}/SKILL.md` - Alternative project skills

---

### `load_skill`
Load a skill's instructions into context from SKILL.md file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Skill name (e.g., 'tdd', 'git', 'frontend-design') |

**Example:**
```json
{ "name": "tdd" }
```

**Common Skills:**
- `tdd` - Test-Driven Development workflow
- `git` - Git best practices
- `security-review` - Security auditing
- `frontend-design` - UI/UX patterns
- `optimize` - Performance optimization
- `audit` - Code quality review

---

### `skill_info`
Get metadata for a specific skill (source, hash, added date).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Skill name (e.g., 'tdd', 'git', 'security-review') |

**Example:**
```json
{ "name": "tdd" }
```

**Returns:**
- Skill name
- Source location
- Hash (full)
- Added date

---

## Core Category (4 tools)

### `bash_execute`
Execute a shell command safely.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | Shell command to execute |
| `cwd` | string | No | Working directory (optional) |

**Example:**
```json
{ "command": "npm install" }
```

---

### `file_read`
Read file contents.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to read |

**Example:**
```json
{ "path": "src/index.ts" }
```

---

### `file_write`
Create or overwrite a file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to create or overwrite |
| `content` | string | Yes | Complete file content to write |

**Example:**
```json
{ "path": "new.ts", "content": "export const x = 1;" }
```

---

### `file_edit`
Perform search-and-replace on a file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | File path to edit |
| `oldText` | string | Yes | Exact text to find |
| `newText` | string | Yes | Replacement text |

**Example:**
```json
{ "path": "file.ts", "oldText": "const x = 1", "newText": "const x = 2" }
```

---

## Discovery Tools

### `list_categories`
List all available tool categories. Call this FIRST to discover what tools are available.

**Parameters:** None

**Example:**
```json
{}
```

**Returns:**
```
Available Categories:
- file: Read, write, edit, list, create, delete, move files (10 tools)
- search: Find files by pattern (glob) or content (grep) (2 tools)
- time: Get current time, convert between timezones (2 tools)
- system: Execute shell commands (bash) (1 tool)
- pdf: Extract text and metadata from PDF files (1 tool)
- agent: Autonomous agent, error memory, todo tracking, sequential thinking (5 tools)
- skills: List, load, and get info about installed skills (3 tools)
- core: Core file operations (bash_execute, file_read, file_write, file_edit) (4 tools)
```

---

### `load_category`
Load detailed tool instructions for a specific category.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | string | Yes | Category name: `file`, `search`, `time`, `system`, `pdf`, `agent`, `skills`, `core` |

**Example:**
```json
{ "category": "file" }
```

---

## Prompt Templates

qwen-core also provides 3 prompt templates:

| Prompt | Description |
|--------|-------------|
| `autonomous-agent` | System prompt for autonomous AI agent behavior with tool usage patterns |
| `skill-loader` | Load and apply skills from ~/.agents/skills/ or ./skills/ |
| `task-planner` | Break down complex tasks into sequential steps with todo tracking |

---

## Quick Reference

### Most Used Tools
1. `sequential_thinking` - Always call first before any action
2. `read_file` / `write_file` / `edit_file` - File operations
3. `glob_search` / `grep_search` - Finding code
4. `bash` - Running commands
5. `todo_write` - Tracking progress

### Typical Workflow
```
1. list_categories          → Discover available tools
2. load_category {file}     → Get file tool instructions
3. sequential_thinking      → Plan your approach
4. glob_search              → Find relevant files
5. read_file                → Read file contents
6. sequential_thinking      → Analyze what needs to change
7. edit_file                → Make the change
8. read_file                → Verify the change
9. bash {git status}        → Check git status
10. todo_write              → Mark task as done
```

---

**qwen-core v2.1.1** | [npm](https://www.npmjs.com/package/qwen-core) | [GitHub](https://github.com/youssefvdel/qwen-core)
