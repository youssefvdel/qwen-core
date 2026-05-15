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
import { initAllowedDirs, getPathRestrictionMessage } from "./utils/PathValidator.js";
import { getTimeoutDescription } from "./utils/TimeoutEstimator.js";
import pkg from "../package.json" with { type: "json" };

const server = new Server({ name: "qwen-core", version: pkg.version }, { capabilities: { tools: {}, prompts: {} } });

const TOOLS = [
  {
    name: "bash",
    description: `Execute shell commands with timeout and working directory support.

USAGE PATTERNS:
- Install packages: bash { command: "npm install" }
- Run scripts: bash { command: "npm run build" }
- Check files: bash { command: "ls -la src/" }
- Git ops: bash { command: "git status" }
- File ops: bash { command: "mkdir -p new/dir" }

BEST PRACTICES:
- Always set cwd for project-specific commands
- Use timeout for long-running commands (default: 30s)
- For file reading/editing, prefer read_file/edit_file tools
- Capture output to verify success

COMMON COMMANDS:
- "npm install", "npm run build", "npm test"
- "git add .", "git commit -m 'msg'", "git push"
- "ls -la", "cat file.txt", "grep pattern file"
- "docker build -t app .", "docker-compose up"

RELATED TOOLS:
- Use before: read_file (verify file exists)
- Use after: git_status (check changes)`,
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        cwd: { type: "string", description: "Working directory for command execution" },
        timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" }
      },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: `Read complete file contents with UTF-8 encoding.

USAGE PATTERNS:
- Read source code: read_file { path: "src/index.ts" }
- Read config: read_file { path: "package.json" }
- Read docs: read_file { path: "README.md" }
- Read nested: read_file { path: "src/components/Button.tsx" }

BEST PRACTICES:
- ALWAYS read before editing - never assume content
- Check file exists with bash "ls" if unsure
- For large files, use read_text_file with head/tail limits
- Read related files together to understand context

WHEN TO USE:
- Before any edit_file operation
- Understanding existing code structure
- Verifying changes after edit
- Analyzing errors that reference specific files

RELATED TOOLS:
- Use before: glob_search (find file path)
- Use after: edit_file (verify changes)
- Alternative: read_multiple_files (batch read)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path to read" },
        encoding: { type: "string", description: "File encoding (default: utf-8)" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: `Create new file or overwrite existing file completely.

USAGE PATTERNS:
- Create new file: write_file { path: "src/new.ts", content: "export const x = 1;" }
- Overwrite config: write_file { path: ".env", content: "KEY=value" }
- Create docs: write_file { path: "docs/guide.md", content: "# Guide\\n\\n..." }
- Generate code: write_file { path: "test.spec.ts", content: "describe(...)" }

BEST PRACTICES:
- Creates parent directories automatically
- COMPLETELY OVERWRITES - use edit_file for partial changes
- Always read existing file first if it might exist
- Ensure content is complete and valid before writing
- Use for: new files, regenerating files, full rewrites

WHEN TO USE:
- Creating new files from scratch
- Regenerating generated code (dist, build outputs)
- Replacing entire file content
- Writing configuration files

WHEN NOT TO USE:
- Don't use for small changes to existing files (use edit_file)
- Don't use to append (read + edit_file instead)

RELATED TOOLS:
- Use before: read_file (check if exists), glob_search (find path)
- Use after: read_file (verify content), bash (run linter)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to create or overwrite" },
        content: { type: "string", description: "Complete file content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_file",
    description: `Search and replace text in a file with optional multiple replacements.

USAGE PATTERNS:
- Single replace: edit_file { path: "src.ts", oldText: "const x = 1", newText: "const x = 2" }
- Replace all: edit_file { path: "src.ts", oldText: "oldFunc", newText: "newFunc", replaceAll: true }
- Fix typo: edit_file { path: "README.md", oldText: "fucntion", newText: "function" }
- Update import: edit_file { path: "app.ts", oldText: "import A from './a'", newText: "import A from './b'" }

BEST PRACTICES:
- ALWAYS read_file first to get exact text to replace
- Include surrounding context (2-3 lines) in oldText for unique match
- Preserve indentation and formatting in newText
- Test with small changes first
- Use replaceAll: true only for systematic renames

COMMON USE CASES:
- Fixing bugs in existing code
- Renaming variables/functions
- Updating imports
- Changing configuration values
- Fixing typos across files

ERROR PREVENTION:
- If oldText not found, error includes first 500 chars of file
- Solution: read file again, get exact text with correct whitespace

RELATED TOOLS:
- REQUIRED before: read_file (get exact content)
- Use after: read_file (verify changes), bash (run tests)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        oldText: { type: "string", description: "Exact text to find (include context for unique match)" },
        newText: { type: "string", description: "Replacement text (preserve formatting)" },
        replaceAll: { type: "boolean", description: "Replace all occurrences (default: false)" }
      },
      required: ["path", "oldText", "newText"]
    }
  },
  {
    name: "glob_search",
    description: `Find files by glob pattern with working directory support.

USAGE PATTERNS:
- Find TypeScript: glob_search { pattern: "**/*.ts" }
- Find tests: glob_search { pattern: "**/*.test.ts" }
- Find configs: glob_search { pattern: "**/package.json" }
- In specific dir: glob_search { pattern: "src/**/*.tsx", cwd: "/project" }
- Absolute paths: glob_search { pattern: "*.md", absolute: true }

GLOB PATTERN SYNTAX:
- "*" = any characters except /
- "**" = any characters including / (recursive)
- "?" = single character
- "{a,b}" = match a or b
- "!" = negate pattern

COMMON PATTERNS:
- "**/*.ts" - all TypeScript files
- "src/**/*.tsx" - TSX files in src
- "**/*.test.{ts,js}" - all test files
- "**/README.md" - all README files
- ".github/**/*.yml" - GitHub Actions workflows

BEST PRACTICES:
- Use specific patterns to reduce results
- Set cwd for project-specific searches
- Use absolute: true for full paths
- Combine with read_file to examine matches

RELATED TOOLS:
- Use before: list_directory (explore structure)
- Use after: read_file (examine found files), grep_search (search content)`,
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx')" },
        cwd: { type: "string", description: "Working directory for search" },
        absolute: { type: "boolean", description: "Return absolute paths (default: false)" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "grep_search",
    description: `Search file contents using ripgrep (rg) or grep with regex support.

USAGE PATTERNS:
- Find function: grep_search { pattern: "function getUser" }
- Find imports: grep_search { pattern: "import.*from.*react" }
- Find TODOs: grep_search { pattern: "TODO|FIXME|HACK" }
- In specific dir: grep_search { pattern: "console.log", path: "src/" }
- Case sensitive: grep_search { pattern: "API", caseSensitive: true }
- File filter: grep_search { pattern: "export", filePattern: "*.ts" }

REGEX PATTERNS:
- "function\\s+\\w+" - function declarations
- "import\\s+\\{.*\\}\\s+from" - named imports
- "class\\s+\\w+\\s+extends" - class inheritance
- "TODO|FIXME|XXX" - code markers
- "\\berror\\b" - exact word match

BEST PRACTICES:
- Use regex for flexible matching
- Set filePattern to narrow search (e.g., "*.ts", "*.tsx")
- Use caseSensitive for acronyms (API, HTTP, URL)
- Set path to specific directories for faster search
- Escape special regex chars: . * + ? ^ $ { } ( ) | \\

WHEN TO USE:
- Finding where a function/class is defined
- Locating all usages of a variable
- Searching for error messages in code
- Finding configuration patterns
- Code archaeology and understanding

RELATED TOOLS:
- Use before: glob_search (find which files to search)
- Use after: read_file (examine specific matches)`,
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Directory to search (default: .)" },
        caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)" },
        filePattern: { type: "string", description: "File glob filter (e.g., '*.ts', '*.tsx')" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "todo_write",
    description: `Manage a structured todo list for tracking task progress.

USAGE PATTERNS:
- Create todos: todo_write { todos: [{ content: "Read codebase", status: "pending" }, { content: "Implement feature", status: "pending" }] }
- Update progress: todo_write { todos: [{ content: "Read codebase", status: "done" }, { content: "Implement feature", status: "in_progress" }] }
- Add new step: todo_write { todos: [...existing, { content: "Write tests", status: "pending" }] }

STATUS VALUES:
- "pending" - not started
- "in_progress" - currently working on
- "done" - completed

BEST PRACTICES:
- Create todos at start of complex tasks
- Update status as you progress
- Keep todos visible in conversation context
- Use for multi-step workflows
- Break large tasks into smaller todos

WHEN TO USE:
- Complex multi-step tasks
- Tracking progress across turns
- Planning before implementation
- Ensuring nothing is forgotten
- Showing user your plan

EXAMPLE WORKFLOW:
1. todo_write: Create plan (5 steps)
2. Update: Step 1 "in_progress"
3. Update: Step 1 "done", Step 2 "in_progress"
4. Continue until all "done"

RELATED TOOLS:
- Use with: sequential_thinking (plan steps), bash (execute steps)`,
    inputSchema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "Task description" },
              status: { type: "string", enum: ["pending", "in_progress", "done"], description: "Current status" }
            },
            required: ["content", "status"]
          },
          description: "Array of todo items"
        }
      },
      required: ["todos"]
    }
  },
  {
    name: "sequential_thinking",
    description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

USAGE PATTERNS:
- Start analysis: sequential_thinking { thought: "First, I need to understand the codebase structure", thoughtNumber: 1, totalThoughts: 5, nextThoughtNeeded: true }
- Deepen analysis: sequential_thinking { thought: "Now examining the main entry point...", thoughtNumber: 2, totalThoughts: 5, nextThoughtNeeded: true }
- Revise: sequential_thinking { thought: "Actually, my initial assumption was wrong...", thoughtNumber: 3, totalThoughts: 6, nextThoughtNeeded: true, isRevision: true, revisesThought: 1 }
- Branch: sequential_thinking { thought: "Alternative approach: use different pattern", thoughtNumber: 4, totalThoughts: 6, nextThoughtNeeded: true, branchFromThought: 2, branchId: "alt-1" }
- Conclude: sequential_thinking { thought: "Solution: implement X with Y pattern", thoughtNumber: 5, totalThoughts: 5, nextThoughtNeeded: false }

PARAMETERS:
- thought: Your current thinking step (required)
- thoughtNumber: Current thought number (required, starts at 1)
- totalThoughts: Estimated total thoughts (required, can adjust up/down)
- nextThoughtNeeded: Whether another thought is needed (required)
- isRevision: Whether this revises previous thinking (optional)
- revisesThought: Which thought is being reconsidered (optional)
- branchFromThought: Branching point thought number (optional)
- branchId: Branch identifier for alternative paths (optional)
- needsMoreThoughts: If more thoughts needed than totalThoughts (optional)

BEST PRACTICES:
- Use before complex actions (editing, implementing)
- Break problems into clear steps
- Question assumptions explicitly
- Revise when new information emerges
- Branch for alternative approaches
- Adjust totalThoughts as understanding evolves
- End with concrete conclusion or plan

WHEN TO USE:
- Understanding complex codebases
- Planning implementations
- Debugging difficult issues
- Making architectural decisions
- Before any major code change
- When stuck and need structured thinking

EXAMPLE FLOW:
1. thought: "Understanding the problem: X needs Y"
2. thought: "Current approach has issues: A, B, C"
3. thought: "Alternative: use pattern Z instead"
4. thought: "Implementation plan: 1) read, 2) edit, 3) test"
5. thought: "Ready to implement with this approach", nextThoughtNeeded: false

RELATED TOOLS:
- Use before: todo_write (create plan), read_file (gather info)
- Use after: edit_file (implement solution)`,
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string", description: "Your current thinking step" },
        nextThoughtNeeded: { type: "boolean", description: "Whether another thought is needed" },
        thoughtNumber: { type: "number", minimum: 1, description: "Current thought number (starts at 1)" },
        totalThoughts: { type: "number", minimum: 1, description: "Estimated total thoughts (adjustable)" },
        isRevision: { type: "boolean", description: "Whether this revises previous thinking" },
        revisesThought: { type: "number", minimum: 1, description: "Which thought number is being reconsidered" },
        branchFromThought: { type: "number", minimum: 1, description: "Thought number to branch from" },
        branchId: { type: "string", description: "Identifier for this branch (e.g., 'alt-1')" },
        needsMoreThoughts: { type: "boolean", description: "If more thoughts needed than totalThoughts" }
      },
      required: ["thought", "nextThoughtNeeded", "thoughtNumber", "totalThoughts"]
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "autonomous_agent",
    description: `Execute development tasks autonomously with build, test, and fix cycles.
Like Claude Code or opencode agents with error memory.

USAGE PATTERNS:
- Fix tests: autonomous_agent { task: "Fix failing unit tests in src/" }
- Build verify: autonomous_agent { task: "Build and verify no errors" }
- Debug issue: autonomous_agent { task: "Debug TypeError in API handler" }
- Custom commands: autonomous_agent { task: "Run linting", buildCommand: "npm run lint", testCommand: "npm run lint" }

PARAMETERS:
- task: Task to execute (required) - describe what needs to be done
- workspaceRoot: Working directory (optional, default: current dir)
- buildCommand: Build command (optional, default: "npm run build")
- testCommand: Test command (optional, default: "npm test")
- maxIterations: Max fix attempts (optional, default: 10, max: 50)

HOW IT WORKS:
1. PLAN: Analyzes task and creates approach
2. BUILD: Runs build command, captures errors
3. TEST: Runs test command, captures failures
4. FIX: Attempts to fix detected errors
5. MEMORY: Remembers failed fixes to avoid repetition
6. REPEAT: Continues until success or max iterations

ERROR MEMORY:
- Never repeats the same failed fix approach
- Tracks what was tried and what failed
- Uses learnings to guide future attempts
- Persists across agent sessions

BEST PRACTICES:
- Use for iterative debugging tasks
- Set specific, clear task descriptions
- Customize build/test commands for your project
- Use error_memory_status to see learned lessons
- Set maxIterations higher for complex bugs

WHEN TO USE:
- Fixing failing tests
- Debugging build errors
- Iterative improvement tasks
- Complex multi-fix scenarios
- When manual fixes aren't working

RELATED TOOLS:
- Use after: error_memory_status (check learned lessons)
- Use after: clear_error_memory (reset if needed)
- Use with: sequential_thinking (plan before agent runs)`,
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task to execute (e.g., 'Fix failing tests', 'Debug build error')" },
        workspaceRoot: { type: "string", description: "Working directory (default: current directory)" },
        buildCommand: { type: "string", description: "Build command (default: 'npm run build')" },
        testCommand: { type: "string", description: "Test command (default: 'npm test')" },
        maxIterations: { type: "number", minimum: 1, maximum: 50, description: "Max fix iterations (default: 10)" }
      },
      required: ["task"]
    }
  },
  {
    name: "error_memory_status",
    description: `Get summary of learned errors and fixes from autonomous agent.

USAGE PATTERNS:
- Check status: error_memory_status {}
- Before debugging: error_memory_status {} (see what's been tried)
- After failure: error_memory_status {} (review lessons learned)

WHAT IT RETURNS:
- Total errors tracked
- Number of errors fixed
- Number of unresolved errors
- Summary of learnings from past attempts

BEST PRACTICES:
- Check before starting debugging session
- Review after autonomous_agent runs
- Use to understand what approaches failed
- Helps avoid repeating mistakes

WHEN TO USE:
- Before running autonomous_agent
- After failed fix attempts
- When debugging seems stuck
- To understand error history

RELATED TOOLS:
- Use with: autonomous_agent (check before/after runs)
- Use before: clear_error_memory (if reset needed)`,
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "clear_error_memory",
    description: `Clear all error memory (removes learned lessons from autonomous agent).

USAGE PATTERNS:
- Reset agent: clear_error_memory {}
- Fresh start: clear_error_memory {} (before new debugging session)
- After success: clear_error_memory {} (clean slate for next task)

WHAT IT DOES:
- Removes all stored error records
- Clears fix attempt history
- Resets learnings database
- Agent starts fresh with no prior knowledge

BEST PRACTICES:
- Use when starting unrelated debugging task
- Use after successfully completing a task
- Use if agent is stuck on old approaches
- Check error_memory_status before clearing

WHEN TO USE:
- Starting new unrelated debugging session
- Old learnings no longer relevant
- Agent repeating unhelpful patterns
- Memory has grown too large

CAUTION:
- All learned lessons will be lost
- Agent may repeat previously failed approaches
- Consider checking status before clearing

RELATED TOOLS:
- Use before: error_memory_status (review what will be lost)
- Use after: autonomous_agent (reset for next task)`,
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_current_time",
    description: `Get current time in a specific timezone.

USAGE PATTERNS:
- Local time: get_current_time { timezone: "America/New_York" }
- UTC time: get_current_time { timezone: "UTC" }
- Asia time: get_current_time { timezone: "Asia/Tokyo" }
- Europe time: get_current_time { timezone: "Europe/London" }

COMMON TIMEZONES:
- "America/New_York" - Eastern Time (ET)
- "America/Los_Angeles" - Pacific Time (PT)
- "America/Chicago" - Central Time (CT)
- "Europe/London" - GMT/BST
- "Europe/Paris" - Central European Time
- "Asia/Tokyo" - Japan Standard Time
- "Asia/Shanghai" - China Standard Time
- "Australia/Sydney" - Australian Eastern Time
- "UTC" - Coordinated Universal Time

BEST PRACTICES:
- Use IANA timezone names (not abbreviations)
- Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
- Includes daylight saving time automatically

WHEN TO USE:
- Scheduling meetings across timezones
- Timestamping events
- Debugging timezone issues
- Coordinating with remote teams

RELATED TOOLS:
- Use with: convert_time (convert between timezones)`,
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "IANA timezone name (e.g., 'America/New_York', 'UTC', 'Asia/Tokyo')" }
      },
      required: ["timezone"]
    }
  },
  {
    name: "convert_time",
    description: `Convert time between timezones.

USAGE PATTERNS:
- Meeting conversion: convert_time { sourceTimezone: "America/New_York", time: "14:00", targetTimezone: "Europe/London" }
- Deadline conversion: convert_time { sourceTimezone: "UTC", time: "23:59", targetTimezone: "America/Los_Angeles" }
- Call scheduling: convert_time { sourceTimezone: "Asia/Tokyo", time: "09:00", targetTimezone: "America/New_York" }

PARAMETERS:
- sourceTimezone: IANA timezone where the time is (required)
- time: Time in HH:MM format (24-hour, required)
- targetTimezone: IANA timezone to convert to (required)

BEST PRACTICES:
- Use 24-hour format (14:00 not 2:00 PM)
- Include leading zeros (09:00 not 9:00)
- Use full IANA timezone names
- Accounts for daylight saving time

COMMON USE CASES:
- Scheduling international meetings
- Converting deadlines
- Planning calls across timezones
- Understanding event times

EXAMPLE:
- "What time is 2 PM NYC in London?"
  convert_time { sourceTimezone: "America/New_York", time: "14:00", targetTimezone: "Europe/London" }

RELATED TOOLS:
- Use with: get_current_time (check current times first)`,
    inputSchema: {
      type: "object",
      properties: {
        sourceTimezone: { type: "string", description: "Source IANA timezone (e.g., 'America/New_York')" },
        time: { type: "string", description: "Time in HH:MM 24-hour format (e.g., '14:00', '09:30')" },
        targetTimezone: { type: "string", description: "Target IANA timezone (e.g., 'Europe/London')" }
      },
      required: ["sourceTimezone", "time", "targetTimezone"]
    }
  },
  {
    name: "read_pdf",
    description: `Extract text, metadata, and images from PDF files.

USAGE PATTERNS:
- Extract all text: read_pdf { path: "/path/to/document.pdf" }
- Specific pages: read_pdf { path: "doc.pdf", pages: "1-5,10" }
- Text only: read_pdf { path: "doc.pdf", includeText: true, includeMetadata: false }
- Metadata only: read_pdf { path: "doc.pdf", includeText: false, includeMetadata: true }

PARAMETERS:
- path: Path to PDF file (required)
- pages: Pages to extract, e.g., "1-5,10" (optional, default: all)
- includeText: Extract text content (optional, default: true)
- includeMetadata: Extract metadata (optional, default: true)
- includeImages: Extract images (optional, default: false)

BEST PRACTICES:
- Use pages parameter for large PDFs
- Include metadata for document info
- Images extraction may be slow

WHEN TO USE:
- Reading documentation PDFs
- Extracting content from reports
- Analyzing research papers
- Processing forms

RELATED TOOLS:
- Use before: glob_search (find PDF files)
- Use after: write_file (save extracted content)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to PDF file" },
        pages: { type: "string", description: "Pages to extract (e.g., '1-5,10' or '1,3,7-10')" },
        includeText: { type: "boolean", description: "Extract text content (default: true)" },
        includeMetadata: { type: "boolean", description: "Extract metadata (default: true)" },
        includeImages: { type: "boolean", description: "Extract images (default: false)" }
      },
      required: ["path"]
    }
  },
  {
    name: "list_skills",
    description: `List all installed Claude Code skills from ~/.agents/skills/.

USAGE PATTERNS:
- List all: list_skills {}

WHAT IT RETURNS:
- Skill name
- Source location
- Hash (first 8 chars)

BEST PRACTICES:
- Check available skills before using
- Skills provide specialized workflows
- Load skills before complex tasks

SKILL LOCATIONS:
- ~/.agents/skills/{name}/SKILL.md - Global skills
- ./skills/{name}/SKILL.md - Project skills
- ./.qwen/skills/{name}/SKILL.md - Alternative project skills

COMMON SKILLS:
- tdd: Test-Driven Development workflow
- git: Git best practices
- security-review: Security auditing
- frontend-design: UI/UX patterns
- optimize: Performance optimization
- audit: Code quality review
- adapt: Responsive design
- animate: UI animations
- polish: Final quality pass

RELATED TOOLS:
- Use before: load_skill (load specific skill)
- Use before: skill_info (get skill details)`,
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "load_skill",
    description: `Load a skill's instructions into context from SKILL.md file.

USAGE PATTERNS:
- Load TDD: load_skill { name: "tdd" }
- Load Git: load_skill { name: "git" }
- Load Design: load_skill { name: "frontend-design" }

WHAT IT DOES:
- Reads ~/.agents/skills/{name}/SKILL.md
- Also checks ./skills/ and ./.qwen/skills/
- Returns full skill instructions
- Skill content injected into conversation

BEST PRACTICES:
- List skills first with list_skills
- Load skill before using its workflow
- Skill instructions persist in context
- Multiple skills can be loaded

SKILL SEARCH ORDER:
1. ~/.agents/skills/{name}/SKILL.md - Global
2. ./skills/{name}/SKILL.md - Project
3. ./.qwen/skills/{name}/SKILL.md - Alternative

WHEN TO USE:
- Before specialized tasks
- When skill provides needed workflow
- Loading best practices guide
- Context for complex operations

RELATED TOOLS:
- Use before: list_skills (see available skills)
- Use before: skill_info (check skill details)`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Skill name (e.g., 'tdd', 'git', 'frontend-design')" }
      },
      required: ["name"]
    }
  },
  {
    name: "skill_info",
    description: `Get metadata for a specific skill (source, hash, added date).

USAGE PATTERNS:
- Check skill: skill_info { name: "tdd" }
- Verify install: skill_info { name: "frontend-design" }

WHAT IT RETURNS:
- Skill name
- Source location
- Hash (full)
- Added date

BEST PRACTICES:
- Verify skill is installed before loading
- Check source location
- Useful for debugging skill issues

WHEN TO USE:
- Before load_skill (verify exists)
- Debugging skill loading issues
- Checking skill version/hash

RELATED TOOLS:
- Use before: list_skills (see all skills)
- Use before: load_skill (load after verification)`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Skill name (e.g., 'tdd', 'git', 'security-review')" }
      },
      required: ["name"]
    }
  },
  // Enhanced Filesystem Tools (from @modelcontextprotocol/server-filesystem)
  {
    name: "read_text_file",
    description: `Read complete file contents as text with optional line limits.

USAGE PATTERNS:
- Read all: read_text_file { path: "src/index.ts" }
- First 50 lines: read_text_file { path: "large.log", head: 50 }
- Last 20 lines: read_text_file { path: "output.log", tail: 20 }
- Config file: read_text_file { path: "package.json" }

PARAMETERS:
- path: File path to read (required)
- head: Read only first N lines (optional, mutually exclusive with tail)
- tail: Read only last N lines (optional, mutually exclusive with head)

BEST PRACTICES:
- Use head for large files to avoid context overflow
- Use tail for log files (recent entries)
- Prefer over read_file when you need line limits
- UTF-8 encoding assumed

WHEN TO USE:
- Reading source code
- Checking config files
- Examining log files
- Reading documentation

RELATED TOOLS:
- Use before: glob_search (find file path)
- Use with: read_multiple_files (batch read)
- Alternative: read_file (no line limits)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        head: { type: "number", description: "Read only first N lines (e.g., 50)" },
        tail: { type: "number", description: "Read only last N lines (e.g., 20)" }
      },
      required: ["path"]
    }
  },
  {
    name: "read_multiple_files",
    description: `Read multiple files simultaneously in a single call.

USAGE PATTERNS:
- Read related files: read_multiple_files { paths: ["src/index.ts", "src/utils.ts", "src/types.ts"] }
- Read configs: read_multiple_files { paths: ["package.json", "tsconfig.json", ".eslintrc.json"] }
- Read tests: read_multiple_files { paths: ["src/a.test.ts", "src/b.test.ts"] }

BEST PRACTICES:
- Use for reading related files together
- More efficient than multiple read_file calls
- Each file content separated by header
- Failed reads show error inline

OUTPUT FORMAT:
=== /path/to/file1.ts ===
<file content>

=== /path/to/file2.ts ===
<file content>

=== /path/to/file3.ts ===
❌ Error: File not found

WHEN TO USE:
- Understanding related modules
- Reading all config files
- Comparing similar files
- Batch reading for context

RELATED TOOLS:
- Use before: glob_search (find files to read)
- Alternative: read_file (single file)
- Alternative: read_text_file (with line limits)`,
    inputSchema: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" }, description: "Array of file paths to read" }
      },
      required: ["paths"]
    }
  },
  {
    name: "list_directory",
    description: `List directory contents with [FILE] or [DIR] prefixes.

USAGE PATTERNS:
- Current dir: list_directory { path: "." }
- Specific dir: list_directory { path: "src/components" }
- Root dir: list_directory { path: "/" }
- Home dir: list_directory { path: "~" }

OUTPUT FORMAT:
[DIR]  src
[DIR]  tests
[FILE] package.json
[FILE] README.md
[FILE] tsconfig.json

BEST PRACTICES:
- Start exploration with directory listing
- Use before glob_search (understand structure)
- Check directory exists before operations
- Sorted alphabetically

WHEN TO USE:
- Exploring unknown codebase
- Finding files in directory
- Verifying directory structure
- Before file operations

RELATED TOOLS:
- Use before: glob_search (narrow search)
- Use before: read_file (get file path)
- Use with: list_directory_with_sizes (see sizes)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list (use '.' for current directory)" }
      },
      required: ["path"]
    }
  },
  {
    name: "create_directory",
    description: `Create new directory or ensure it exists (creates parents if needed).

USAGE PATTERNS:
- Create single: create_directory { path: "new-folder" }
- Create nested: create_directory { path: "src/components/buttons" }
- Ensure exists: create_directory { path: "dist/assets" }

BEST PRACTICES:
- Creates parent directories automatically (like mkdir -p)
- Safe to call on existing directories (no error)
- Use before write_file for new directories
- No permission errors if directory exists

WHEN TO USE:
- Creating new folder structure
- Setting up project directories
- Before writing files to new paths
- Ensuring directory exists

RELATED TOOLS:
- Use before: write_file (create destination)
- Use after: list_directory (verify creation)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to create (parents created automatically)" }
      },
      required: ["path"]
    }
  },
  {
    name: "move_file",
    description: `Move or rename files and directories.

USAGE PATTERNS:
- Rename file: move_file { source: "old-name.txt", destination: "new-name.txt" }
- Move file: move_file { source: "src/old.ts", destination: "src/new.ts" }
- Move to dir: move_file { source: "file.txt", destination: "docs/file.txt" }
- Move directory: move_file { source: "old-folder", destination: "new-folder" }

BEST PRACTICES:
- Destination parent must exist (create with create_directory first)
- Overwrites destination if it exists
- Works for both files and directories
- Use absolute paths for clarity

WHEN TO USE:
- Renaming files
- Reorganizing directory structure
- Moving files between folders
- Restructuring projects

CAUTION:
- Overwrites existing destination files
- Parent directory must exist

RELATED TOOLS:
- Use before: create_directory (ensure parent exists)
- Use after: list_directory (verify move)
- Use before: delete_file (alternative for removal)`,
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Source file or directory path" },
        destination: { type: "string", description: "Destination path (must have existing parent directory)" }
      },
      required: ["source", "destination"]
    }
  },
  {
    name: "delete_file",
    description: `Delete a file permanently.

USAGE PATTERNS:
- Delete file: delete_file { path: "temp.txt" }
- Delete log: delete_file { path: "logs/error.log" }
- Delete build: delete_file { path: "dist/bundle.js" }

BEST PRACTICES:
- VERIFY path before deletion
- Use get_file_info first to confirm target
- Check with list_directory
- Consider moving instead of deleting (move_file)

SAFETY CHECKLIST:
1. Confirm correct file path
2. Verify file is not needed
3. Check no references to file
4. Consider backup first

WHEN TO USE:
- Removing temporary files
- Cleaning build artifacts
- Deleting obsolete files
- Removing sensitive data

CAUTION:
- PERMANENT - cannot be undone
- No trash/recycle bin
- Verify path carefully

RELATED TOOLS:
- Use before: get_file_info (verify target)
- Use before: list_directory (confirm exists)
- Alternative: move_file (safer, can recover)`,
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
    description: `Delete a directory and its contents.

USAGE PATTERNS:
- Delete dir: delete_directory { path: "temp-folder" }
- Delete nested: delete_directory { path: "dist/assets" }
- Force delete: delete_directory { path: "node_modules", recursive: true }

PARAMETERS:
- path: Directory path to delete (required)
- recursive: Delete recursively (optional, default: true)

BEST PRACTICES:
- VERIFY path before deletion
- Use list_directory first to see contents
- Check for important files
- Consider moving instead of deleting

SAFETY CHECKLIST:
1. Confirm correct directory path
2. List contents first (list_directory)
3. Verify no important files
4. Check no active processes using files

WHEN TO USE:
- Cleaning build directories
- Removing temporary folders
- Deleting obsolete modules
- Clearing cache directories

CAUTION:
- PERMANENT - cannot be undone
- Deletes ALL contents recursively
- No trash/recycle bin
- Verify path carefully

RELATED TOOLS:
- Use before: list_directory (see contents first)
- Use before: directory_tree (full structure)
- Use before: get_file_info (verify target)`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to delete" },
        recursive: { type: "boolean", description: "Delete recursively (default: true)" }
      },
      required: ["path"]
    }
  },
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
      
      case "todo_write": {
        const list = a.todos.map((t: any, i: number) => 
          `${i + 1}. [${t.status || "pending"}] ${t.content}`
        ).join("\n");
        return { content: [{ type: "text", text: `📋 Todos:\n${list}` }] };
      }
      
      case "sequential_thinking": {
        const { SequentialThinkingServer, coerceBoolean } = await import('./tools/SequentialThinkingTool.js');
        const thinkingServer = new SequentialThinkingServer();
        const result = thinkingServer.processThought({
          thought: a.thought,
          thoughtNumber: a.thoughtNumber,
          totalThoughts: a.totalThoughts,
          nextThoughtNeeded: coerceBoolean(a.nextThoughtNeeded),
          isRevision: a.isRevision !== undefined ? coerceBoolean(a.isRevision) : undefined,
          revisesThought: a.revisesThought,
          branchFromThought: a.branchFromThought,
          branchId: a.branchId,
          needsMoreThoughts: a.needsMoreThoughts !== undefined ? coerceBoolean(a.needsMoreThoughts) : undefined
        });
        
        if (result.isError) return result;
        
        const parsedContent = JSON.parse(result.content[0].text);
        return { content: result.content, structuredContent: parsedContent };
      }
      
      case "autonomous_agent": {
        const { executeAutonomousTask } = await import('./agent/AutonomousAgent.js');
        return executeAutonomousTask({
          task: a.task,
          workspaceRoot: a.workspaceRoot,
          buildCommand: a.buildCommand,
          testCommand: a.testCommand,
          maxIterations: a.maxIterations
        });
      }
      
      case "error_memory_status": {
        const { getErrorMemoryStatus } = await import('./agent/AutonomousAgent.js');
        return { content: [{ type: "text", text: getErrorMemoryStatus() }] };
      }
      
      case "clear_error_memory": {
        const { clearErrorMemory } = await import('./agent/AutonomousAgent.js');
        clearErrorMemory();
        return { content: [{ type: "text", text: "✅ Error memory cleared" }] };
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
      
      case "create_directory": {
        await fs.mkdir(a.path, { recursive: true });
        return { content: [{ type: "text", text: `✅ Created: ${a.path}` }] };
      }
      
      case "move_file": {
        await fs.rename(a.source, a.destination);
        return { content: [{ type: "text", text: `✅ Moved: ${a.source} → ${a.destination}` }] };
      }
      
      case "delete_file": {
        await fs.unlink(a.path);
        return { content: [{ type: "text", text: `✅ Deleted: ${a.path}` }] };
      }
      
      case "delete_directory": {
        await fs.rm(a.path, { recursive: a.recursive !== false, force: true });
        return { content: [{ type: "text", text: `✅ Deleted: ${a.path}` }] };
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
        const autonomousPrompt = `You are an autonomous AI agent with access to 39 tools.

⚠️ CRITICAL RULE - ALWAYS USE TOOLS:
- NEVER just explain what you would do - ACTUALLY DO IT WITH TOOLS
- NEVER say "I can help with that" without calling a tool
- NEVER describe steps without executing them
- If a tool exists for the task, YOU MUST USE IT
- Only use text explanations AFTER tool execution to explain results

TOOL-FIRST MANDATE:
1. See task → Find matching tool → CALL IT IMMEDIATELY
2. Only explain AFTER you have tool results
3. No tool calls = you haven't done the task
4. Users want ACTIONS not explanations

AVAILABLE TOOLS (USE THEM):
- File ops: read_file, write_file, edit_file, read_text_file, read_multiple_files
- Directory: list_directory, create_directory, delete_directory, move_file, delete_file
- Search: glob_search (find files), grep_search (find content)
- System: bash
- Time: get_current_time, convert_time
- PDF: read_pdf
- Thinking: sequential_thinking (plan before complex actions)
- Tasks: todo_write (track progress)
- Agent: autonomous_agent (build/test/fix cycles)
- Skills: list_skills, load_skill, skill_info

CORE PROTOCOL:
1. THINK FIRST: Use sequential_thinking before any complex action
2. PLAN: Break tasks into steps using todo_write
3. ACT: USE TOOLS - call them immediately, don't just describe
4. OBSERVE: Check tool results carefully
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
- Explain reasoning AFTER tool execution
- Report progress on complex tasks
- Ask for clarification when needed
- NEVER explain what you'll do - JUST DO IT WITH TOOLS

REMEMBER:
- Tools are your hands - use them constantly
- No tool call = task not started
- Users want results, not explanations of how you'd get results
- Think → Plan → ACT (tools) → Observe → Correct`;
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
  console.error(`🌐 qwen-core v${pkg.version} starting...`);
  
  // Initialize path validation
  initAllowedDirs();
  console.error(`🔒 ${getPathRestrictionMessage()}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Ready - 28 tools + 3 prompts loaded");
  console.error("📦 Categories: File (8), Search (2), Git (0), Time (2), PDF (1), System (1), Skills (3), Agent (3), Core (8)");
  console.error("🧠 Prompts: autonomous-agent, skill-loader, task-planner");
  console.error("📁 Skills auto-load from: ~/.agents/skills/, ./skills/, ./.qwen/skills/");
}

main().catch(e => { 
  console.error("💥 Fatal error:", e); 
  process.exit(1); 
});
