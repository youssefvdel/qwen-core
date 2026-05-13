# Qwen-Core Integration Guide for Qwen Studio

**For:** AI agents and developers working on integrating qwen-core MCP server into qwen-studio

**Version:** 2.0.0  
**Last Updated:** May 13, 2026

---

## 📋 Overview

This document provides everything you need to know before integrating **qwen-core** (the enhanced MCP server) into **qwen-studio** (the Electron desktop app).

### What is Qwen-Core?
- **21 tools** for file ops, git, time, PDF, web search, shell execution
- **3 prompt templates** for autonomous agent behavior
- **Skills system** with auto-loading from multiple locations
- **Self-correction protocol** for autonomous task completion

### What is Qwen Studio?
- Electron-based desktop client for chat.qwen.ai
- Linux-native (AppImage, .deb, .rpm)
- Built-in MCP support with runtime bundling (Bun, UV)
- Skills manager for system prompt injection
- System tray, multi-language, theme support

---

## 🏗️ Architecture Understanding

### Qwen Studio MCP Architecture

```
qwen-studio/
├── src/
│   ├── main/
│   │   ├── mcp-config.ts      # Config adapter (rewrites paths for bundled runtimes)
│   │   ├── runtime.ts         # Locates bundled Bun/UV binaries
│   │   ├── skills-manager.ts  # System prompt injection into chat.qwen.ai
│   │   └── ipc-handlers.ts    # IPC between main and renderer
│   ├── mcp/
│   │   ├── index.ts           # MCP module exports
│   │   ├── proxy.ts           # MCP proxy layer
│   │   └── server-client.ts   # MCP server communication
│   └── shared/
│       └── types.ts           # Shared TypeScript types
└── resources/
    ├── bun/                   # Bundled Bun runtime (linux-x64, linux-arm64)
    └── uv/                    # Bundled UV runtime (uv, uvx)
```

### Key Integration Points

1. **MCP Config** (`src/main/mcp-config.ts`)
   - Rewrites `npx`, `bun`, `uvx` commands to use bundled binaries
   - Fixes macOS paths to Linux home directories
   - Sets PATH environment with bundled runtime directories

2. **Skills Manager** (`src/main/skills-manager.ts`)
   - Stores skills in `~/.config/qwen-studio/skills/`
   - Injects skill content into chat input via JavaScript
   - Uses React `nativeInputValueSetter` pattern + MutationObserver fallback

3. **MCP Proxy** (`src/mcp/proxy.ts`)
   - Handles stdio transport communication
   - Manages server lifecycle
   - Bridges MCP messages to/from renderer

---

## 🔧 Integration Requirements

### Before You Start

1. **Understand the MCP Flow:**
   ```
   User Action → Renderer → IPC → Main Process → MCP Proxy → MCP Server (stdio)
   Response ← Renderer ← IPC ← Main Process ← MCP Proxy ← MCP Server
   ```

2. **Know the Runtime Bundling:**
   - Bun: `resources/bun/linux-x64/bun`
   - UV: `resources/uv/linux-x64/uv` and `uvx`
   - These paths are resolved by `getBunPath()` and `getUvxPath()` in `runtime.ts`

3. **Skills System Differences:**
   - **qwen-studio:** Skills are `.md` files injected into chat input
   - **qwen-core:** Skills are loaded via MCP prompts/tools with auto-discovery
   - **Integration:** Need to unify or bridge these approaches

---

## 🎯 Integration Options

### Option 1: Full qwen-core as Primary MCP (Recommended)

Replace existing MCP setup with qwen-core:

**Pros:**
- All 21 tools available
- Autonomous agent capabilities
- Better skills system
- Git, time, PDF tools out of box

**Implementation Steps:**

1. **Update MCP Config** (`src/main/mcp-config.ts`):
```typescript
// Add qwen-core to adapted configs
if (key === "qwen-core") {
  config.command = getBunPath(); // Use bundled bun
  config.args = ["tsx", path.join(__dirname, "../../qwen-core/src/index.ts")];
}
```

2. **Register qwen-core** in main process:
```typescript
// src/main/index.ts or dedicated mcp-loader.ts
import { adaptConfig } from "./mcp-config";

const MCP_SERVERS = {
  "qwen-core": {
    command: "npx",
    args: ["tsx", "src/index.ts"],
    cwd: "/path/to/qwen-core"
  }
};

const adapted = adaptConfig(MCP_SERVERS);
// Start server with adapted config
```

3. **Unify Skills Systems:**
   - Merge `~/.config/qwen-studio/skills/` with `~/.agents/skills/`
   - Or have qwen-studio skills-manager load from both locations

4. **Add Prompts UI:**
   - Create renderer UI for selecting prompts (`autonomous-agent`, `skill-loader`, `task-planner`)
   - IPC handlers to fetch and apply prompts

---

### Option 2: Hybrid Approach (qwen-core + Existing MCP)

Keep existing MCP servers and add qwen-core as additional server:

**Pros:**
- No breaking changes
- Gradual migration
- Users keep existing configs

**Implementation:**

1. **Add qwen-core to default servers:**
```typescript
// src/main/mcp-config.ts or config defaults
const DEFAULT_SERVERS = {
  // ... existing servers
  "qwen-core": {
    command: "npx",
    args: ["tsx", "path/to/qwen-core/src/index.ts"],
    enabled: true
  }
};
```

2. **Skills Bridge:**
```typescript
// Create a skill sync between systems
export function syncSkillsToQwenCore() {
  const studioSkills = getAvailableSkills(); // from ~/.config/qwen-studio/skills/
  const coreSkillsDir = path.join(os.homedir(), ".agents/skills/");
  
  // Copy/link skills between directories
  for (const skill of studioSkills) {
    // Copy or symlink
  }
}
```

---

### Option 3: qwen-core as Optional Plugin

Make qwen-core an installable plugin:

**Pros:**
- Users opt-in
- Smaller default install
- Clear separation

**Implementation:**

1. **Add to Settings UI:**
   - Checkbox: "Enable qwen-core MCP server"
   - Auto-download and configure on enable

2. **Plugin Manager:**
```typescript
interface McpPlugin {
  id: string;
  name: string;
  repo: string;
  installed: boolean;
  enabled: boolean;
  install(): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
}
```

---

## 📁 Skills System Integration

### Current State

| System | Location | Format | Loading |
|--------|----------|--------|---------|
| qwen-studio | `~/.config/qwen-studio/skills/` | `.md`, `.txt` | Manual selection from menu |
| qwen-core | `~/.agents/skills/`, `./skills/` | `SKILL.md` with metadata | Auto-load + MCP tools |

### Unification Strategy

**Option A: Merge Directories**
```typescript
// In skills-manager.ts
const SKILLS_DIRS = [
  path.join(app.getPath("userData"), "skills"), // qwen-studio
  path.join(os.homedir(), ".agents/skills"),    // qwen-core global
  path.join(process.cwd(), "skills")            // qwen-core project
];

export async function getAllSkills() {
  const allSkills = [];
  for (const dir of SKILLS_DIRS) {
    const skills = await readSkillsFromDir(dir);
    allSkills.push(...skills);
  }
  return allSkills;
}
```

**Option B: Bridge via Symlinks**
```bash
# On qwen-core install/enable
ln -s ~/.config/qwen-studio/skills/* ~/.agents/skills/
```

**Option C: Unified Config**
```typescript
// settings.json
{
  "skills": {
    "sources": [
      "~/.config/qwen-studio/skills/",
      "~/.agents/skills/",
      "./skills/"
    ],
    "preferredFormat": "qwen-core" // or "studio"
  }
}
```

---

## 🛠️ Code Changes Required

### 1. Main Process (`src/main/`)

**File: `src/main/mcp-config.ts`**
```typescript
// ADD: qwen-core specific config
export function getQwenCoreConfig(): McpServerConfig {
  return {
    command: getBunPath(),
    args: ["tsx", path.join(__dirname, "../../../qwen-core/src/index.ts")],
    cwd: path.join(__dirname, "../../../qwen-core"),
    env: {
      ...process.env,
      PATH: getEnhancedPath()
    }
  };
}
```

**File: `src/main/skills-manager.ts`**
```typescript
// ADD: Load qwen-core skills
export async function getQwenCoreSkills(): Promise<string[]> {
  const coreSkillsDir = path.join(os.homedir(), ".agents/skills");
  // Read and return skill names
}

// MODIFY: getAvailableSkills() to include both
export async function getAvailableSkills(): Promise<string[]> {
  const studioSkills = await getStudioSkills();
  const coreSkills = await getQwenCoreSkills();
  return [...studioSkills, ...coreSkills];
}
```

**File: `src/main/ipc-handlers.ts`**
```typescript
// ADD: IPC handlers for qwen-core features
ipcMain.handle("qwen-core:list-skills", async () => {
  return await getQwenCoreSkills();
});

ipcMain.handle("qwen-core:load-skill", async (_, name) => {
  return await loadQwenCoreSkill(name);
});

ipcMain.handle("qwen-core:get-prompts", async () => {
  return await getQwenCorePrompts();
});
```

---

### 2. Renderer Process (UI Changes)

**New Components Needed:**

1. **Prompts Selector** (in chat sidebar)
```typescript
// PromptsDropdown.tsx
function PromptsDropdown() {
  const [prompts, setPrompts] = useState([]);
  
  useEffect(() => {
    ipcRenderer.invoke("qwen-core:get-prompts").then(setPrompts);
  }, []);
  
  return (
    <Dropdown>
      {prompts.map(p => (
        <MenuItem 
          key={p.name}
          onClick={() => applyPrompt(p.name)}
        >
          {p.name}
        </MenuItem>
      ))}
    </Dropdown>
  );
}
```

2. **Skills Manager Enhancement**
```typescript
// Existing skills menu now shows both sources
function SkillsMenu() {
  const skills = useSkills(); // Now includes qwen-core skills
  
  return (
    <Menu>
      <MenuSection label="Qwen Studio Skills">
        {skills.studio.map(s => <SkillItem key={s} skill={s} />)}
      </MenuSection>
      <MenuSection label="Qwen Core Skills">
        {skills.core.map(s => <SkillItem key={s} skill={s} />)}
      </MenuSection>
    </Menu>
  );
}
```

---

### 3. Shared Types (`src/shared/types.ts`)

**ADD:**
```typescript
export interface QwenCoreSkill {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  content: string;
  source: "studio" | "core-global" | "core-project";
}

export interface QwenCorePrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface McpPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  config: McpServerConfig;
}
```

---

## 🔌 MCP Server Registration

### In Main Process

```typescript
// src/main/mcp-manager.ts (new file)
import { McpServerClient } from "../mcp/server-client";

export class McpManager {
  private servers: Map<string, McpServerClient> = new Map();
  
  async registerServer(name: string, config: McpServerConfig) {
    const client = new McpServerClient(config);
    await client.connect();
    this.servers.set(name, client);
    
    // Listen for tool updates
    client.on("tools/changed", (tools) => {
      this.notifyRenderer("mcp:tools-updated", { server: name, tools });
    });
  }
  
  async callTool(server: string, tool: string, args: any) {
    const client = this.servers.get(server);
    if (!client) throw new Error(`Server ${server} not found`);
    return await client.callTool(tool, args);
  }
  
  async listTools() {
    const allTools = [];
    for (const [name, client] of this.servers) {
      const tools = await client.listTools();
      allTools.push(...tools.map(t => ({ ...t, server: name })));
    }
    return allTools;
  }
}

// Usage in src/main/index.ts
const mcpManager = new McpManager();
await mcpManager.registerServer("qwen-core", getQwenCoreConfig());
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// __tests__/mcp-config.test.ts
describe("adaptConfig for qwen-core", () => {
  it("should rewrite npx to bundled bun", () => {
    const config = {
      "qwen-core": {
        command: "npx",
        args: ["tsx", "src/index.ts"]
      }
    };
    
    const adapted = adaptConfig(config);
    expect(adapted["qwen-core"].command).toContain("/bun");
    expect(adapted["qwen-core"].args).toContain("-y");
  });
});
```

### Integration Tests

```typescript
// __tests__/integration.test.ts
describe("qwen-core integration", () => {
  it("should load all 21 tools", async () => {
    const tools = await mcpManager.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(21);
  });
  
  it("should have git tools", () => {
    const tools = await mcpManager.listTools();
    const gitTools = tools.filter(t => t.name.startsWith("git_"));
    expect(gitTools.length).toBe(5);
  });
  
  it("should load autonomous-agent prompt", async () => {
    const prompts = await mcpManager.getPrompts();
    expect(prompts.find(p => p.name === "autonomous-agent")).toBeDefined();
  });
});
```

### Manual Testing Checklist

- [ ] qwen-core server starts without errors
- [ ] All 21 tools are accessible from renderer
- [ ] Skills from both systems appear in menu
- [ ] Prompts can be selected and applied
- [ ] Git tools work with local repositories
- [ ] PDF reader extracts text correctly
- [ ] Time tools return correct timezones
- [ ] Bash commands execute with proper timeouts
- [ ] File operations respect permissions
- [ ] System tray still works
- [ ] No performance degradation

---

## 🔒 Security Considerations

### Before Integration

1. **Review qwen-core code:**
   - Check `src/index.ts` for any unsafe operations
   - Verify tool implementations don't expose vulnerabilities
   - Ensure no hardcoded secrets

2. **Sandboxing:**
   - qwen-core runs as separate stdio process (good)
   - Consider adding `--allow-dir` flags for file tools
   - Set reasonable timeouts on all tools

3. **IPC Security:**
   - Validate all IPC arguments in handlers
   - Use contextBridge properly in preload
   - Don't expose raw MCP client to renderer

### Recommended Security Measures

```typescript
// In mcp-config.ts
const SECURE_ENV = {
  ...process.env,
  MCP_ALLOWED_DIRS: "/home,/tmp,/projects", // Restrict file access
  MCP_NO_HTTP: "true", // Disable web tools if not needed
  MCP_TIMEOUT: "30000" // Global timeout
};

config.env = { ...config.env, ...SECURE_ENV };
```

---

## 📦 Build & Distribution

### Updating Build Config

**File: `electron-builder.yml`**
```yaml
extraResources:
  - from: "../qwen-core"
    to: "qwen-core"
    filter: ["**/*", "!node_modules", "!dist", "!.git"]
  - from: "resources/bun"
    to: "resources/bun"
  - from: "resources/uv"
    to: "resources/uv"
```

**File: `forge.config.ts`**
```typescript
export default {
  // ...
  extraResource: [
    "../qwen-core",
    "./resources/bun",
    "./resources/uv"
  ]
};
```

### Package Size Impact

- qwen-core source: ~500 KB
- Dependencies: ~5 MB (already have most)
- **Total impact: ~6 MB** (acceptable)

### Version Management

```typescript
// Track qwen-core version in package.json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.13.1",
    // ...
  },
  "qwenCoreVersion": "2.0.0" // Track separately
}
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Server Won't Start**
```
Error: Cannot find module 'pdf-parse'
```
**Fix:** Run `npm install` in qwen-core directory

**2. Tools Not Showing**
```typescript
// Debug: Check if server connected
console.log("MCP Servers:", mcpManager.servers.keys());
```

**3. Skills Not Loading**
```bash
# Check skill directories exist
ls -la ~/.agents/skills/
ls -la ~/.config/qwen-studio/skills/
```

**4. Runtime Path Issues**
```typescript
// Debug runtime paths
console.log("Bun path:", getBunPath());
console.log("UV path:", getUvxPath());
console.log("Resources:", process.resourcesPath);
```

**5. IPC Communication Fails**
```typescript
// In renderer, check IPC bridge
ipcRenderer.invoke("ping").then(console.log); // Should return "pong"
```

---

## 📚 Reference Documentation

### Qwen Studio
- **Main README:** `/Projects/qwen-studio/README.md`
- **MCP Config:** `src/main/mcp-config.ts`
- **Skills Manager:** `src/main/skills-manager.ts`
- **Types:** `src/shared/types.ts`

### Qwen Core
- **Main README:** `/Projects/qwen-core/README.md`
- **Server Implementation:** `src/index.ts`
- **Skills:** `skills/` directory
- **Tools:** Listed in `src/index.ts:TOOLS`

### MCP Protocol
- **Official Spec:** https://modelcontextprotocol.io/
- **SDK Docs:** https://github.com/modelcontextprotocol/sdk

---

## ✅ Integration Checklist

### Phase 1: Preparation
- [ ] Read this entire document
- [ ] Understand qwen-studio MCP architecture
- [ ] Test qwen-core standalone
- [ ] Review security implications

### Phase 2: Code Changes
- [ ] Add qwen-core to mcp-config.ts
- [ ] Create McpManager class
- [ ] Add IPC handlers for new features
- [ ] Update skills-manager.ts for unified skills
- [ ] Add prompts UI components

### Phase 3: Testing
- [ ] Unit tests for config adaptation
- [ ] Integration tests for all tools
- [ ] Manual testing checklist complete
- [ ] Performance testing (no slowdowns)

### Phase 4: Build & Release
- [ ] Update electron-builder config
- [ ] Test AppImage build
- [ ] Test .deb build
- [ ] Test .rpm build
- [ ] Update README with qwen-core features
- [ ] Create migration guide for existing users

### Phase 5: Documentation
- [ ] Update qwen-studio README
- [ ] Add qwen-core section to FAQ
- [ ] Create user guide for new features
- [ ] Update screenshots to show new UI

---

## 🎓 Learning Resources

### For AI Agents Working on Integration

1. **Start Here:**
   - Read `src/main/mcp-config.ts` - understand runtime adaptation
   - Read `src/main/skills-manager.ts` - understand skill injection
   - Read `src/mcp/proxy.ts` - understand server communication

2. **Key Concepts:**
   - Electron IPC (Inter-Process Communication)
   - MCP stdio transport
   - React value setters for controlled inputs
   - Node.js child_process for stdio servers

3. **Similar Implementations:**
   - Official Qwen Desktop (Windows/Mac) - reference for MCP
   - Claude Desktop - similar skills system
   - Cursor IDE - MCP integration patterns

---

## 📞 Support

**For questions or issues:**
- Check existing issues on qwen-studio repo
- Review qwen-core documentation
- Test with MCP inspector: `npx @modelcontextprotocol/inspector`

**Debugging Tools:**
```bash
# View MCP logs
tail -f ~/.config/qwen-studio/logs/mcp*.log

# Test qwen-core directly
cd qwen-core && npm start

# Inspect MCP traffic
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

---

**Good luck with the integration! 🚀**

Remember: Start small (Option 2 - Hybrid), test thoroughly, and iterate based on user feedback.
