# Qwen-Core MCP Configuration Guide

**For:** Qwen Studio Linux  
**Version:** 2.0.0  
**Last Updated:** May 13, 2026

---

## 📋 Overview

This guide explains how qwen-core is configured and bundled within qwen-studio, and how the path resolution works in both development and production builds.

---

## 🏗️ Architecture

### Path Resolution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Qwen Studio App                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────────┐    │
│  │ Development Mode │         │   Production Mode    │    │
│  │                  │         │   (Packaged App)     │    │
│  │  qwen-core/      │         │  resources/          │    │
│  │  └── src/        │         │  └── resources/      │    │
│  │      └── index.ts│         │      └── qwen-core/  │    │
│  │                  │         │          └── src/    │    │
│  │  Path:           │         │              └── index.ts│  │
│  │  ./qwen-core/src/│         │                      │    │
│  │  index.ts        │         │  Path:               │    │
│  │                  │         │  resourcesPath/      │    │
│  │                  │         │  resources/qwen-core/│    │
│  │                  │         │  src/index.ts        │    │
│  └──────────────────┘         └──────────────────────┘    │
│                                                             │
│  Both resolved by: getQwenCorePath() in mcp-config.ts      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuration Files

### 1. `src/main/mcp-config.ts`

**Key Functions:**

#### `getQwenCorePath(): string`
Resolves the path to qwen-core's `src/index.ts`:

```typescript
// In Development:
/app-root/qwen-core/src/index.ts

// In Production (Packaged):
/resources-path/resources/qwen-core/src/index.ts
```

**Implementation:**
```typescript
export function getQwenCorePath(): string {
  if (app.isPackaged) {
    // Production: bundled inside resources
    return path.join(process.resourcesPath, "resources", "qwen-core", "src", "index.ts");
  }
  // Development: local folder
  return path.join(app.getAppPath(), "qwen-core", "src", "index.ts");
}
```

#### `getDefaultQwenCoreConfig(): McpServerConfig`
Returns the default MCP server configuration:

```typescript
export function getDefaultQwenCoreConfig(): McpServerConfig {
  return {
    command: "bun", // Will be replaced with bundled bun by adaptConfig()
    args: ["tsx", getQwenCorePath()],
    cwd: app.isPackaged 
      ? path.join(process.resourcesPath, "resources", "qwen-core")
      : path.join(app.getAppPath(), "qwen-core"),
  };
}
```

#### `adaptConfig(configs: McpConfig): McpConfig`
Replaces `bun` command with bundled bun path and fixes arguments:

```typescript
if (key === "Qwen-Core" || key === "qwen-core") {
  cmd = correctBunPath; // Replace with bundled bun
  
  if (app.isPackaged) {
    // Update cwd to packaged location
    config.cwd = path.join(process.resourcesPath, "resources", "qwen-core");
    
    // Update path argument to use bundled location
    const corePath = getQwenCorePath();
    config.args = config.args.map(arg => 
      arg.includes("qwen-core") ? corePath : arg
    );
  }
}
```

---

### 2. `src/main/index.ts`

**Default MCP Config:**

```typescript
function getDefaultMcpConfig(): McpConfig {
  const bunPath = getBunPath();
  
  return {
    "qwen-core": getDefaultQwenCoreConfig(), // Uses function above
    "fetch": {
      command: bunPath,
      args: ["x", "-y", "@modelcontextprotocol/server-fetch"],
    },
    // ... other servers
  };
}
```

**Auto-Healing:**
```typescript
async function loadMcpConfig(): Promise<McpConfig> {
  const defaults = getDefaultMcpConfig();
  
  if (await settings.has(MCP_CONFIG_KEY)) {
    const config = await settings.get(MCP_CONFIG_KEY);
    
    // Auto-add qwen-core if missing
    if (!parsed["qwen-core"]) {
      console.log("[Config] qwen-core missing, adding...");
      parsed["qwen-core"] = defaults["qwen-core"];
      await settings.set(MCP_CONFIG_KEY, parsed as any);
    }
    
    return parsed;
  }
  
  return defaults;
}
```

---

### 3. `electron-builder.yml`

**Bundling Configuration:**

```yaml
files:
  - "qwen-core/**/*"              # Include qwen-core source
  - "!qwen-core/*.md"             # Exclude markdown files
  - "!qwen-core/.git/**/*"        # Exclude git data
  - "!qwen-core/node_modules/**/*" # Use root node_modules
  - "!qwen-core/dist/**/*"        # Exclude build artifacts

extraResources:
  - from: "resources/bun"
    to: "resources/bun"
  - from: "resources/uv"
    to: "resources/uv"
```

**Resulting Structure in Packaged App:**
```
/opt/Qwen Studio/resources/
├── resources/           # ← Note: double nesting due to electron-builder
│   ├── bun/
│   │   └── linux-x64/
│   │       └── bun-linux-x64/bun
│   ├── uv/
│   │   └── linux-x64/
│   │       └── uv-x86_64-unknown-linux-musl/uv
│   └── qwen-core/
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── skills/
└── icon.png
```

---

## 🚀 How It Works

### Development Mode

1. **App Starts:**
   ```
   $ npm start
   ```

2. **Path Resolution:**
   ```typescript
   getQwenCorePath() → /home/user/Projects/qwen-studio/qwen-core/src/index.ts
   ```

3. **MCP Config:**
   ```json
   {
     "qwen-core": {
       "command": "/path/to/bun",
       "args": ["tsx", "/home/user/Projects/qwen-studio/qwen-core/src/index.ts"],
       "cwd": "/home/user/Projects/qwen-studio/qwen-core"
     }
   }
   ```

4. **Server Starts:**
   ```
   bun tsx /home/user/Projects/qwen-studio/qwen-core/src/index.ts
   ```

---

### Production Mode (Packaged App)

1. **App Installed:**
   ```
   /opt/Qwen Studio/
   ```

2. **Path Resolution:**
   ```typescript
   getQwenCorePath() → /opt/Qwen Studio/resources/resources/qwen-core/src/index.ts
   ```

3. **MCP Config (After adaptConfig):**
   ```json
   {
     "qwen-core": {
       "command": "/opt/Qwen Studio/resources/resources/bun/linux-x64/bun-linux-x64/bun",
       "args": ["tsx", "/opt/Qwen Studio/resources/resources/qwen-core/src/index.ts"],
       "cwd": "/opt/Qwen Studio/resources/resources/qwen-core",
       "env": {
         "PATH": "/opt/Qwen Studio/resources/resources/bun/...:/usr/local/bin:/usr/bin:/bin",
         "MCP_ALLOWED_DIRS": "/home/user,/tmp",
         "MCP_TIMEOUT": "60000"
       }
     }
   }
   ```

4. **Server Starts:**
   ```
   /opt/Qwen Studio/resources/resources/bun/.../bun \
     tsx \
     /opt/Qwen Studio/resources/resources/qwen-core/src/index.ts
   ```

---

## 📁 Directory Structure

### Development
```
qwen-studio/
├── src/
│   └── main/
│       ├── mcp-config.ts         # Path resolution logic
│       ├── index.ts              # Default config
│       └── runtime.ts            # Bun/UV path helpers
├── qwen-core/                    # Local qwen-core folder
│   ├── src/
│   │   └── index.ts
│   ├── skills/
│   └── package.json
└── resources/
    ├── bun/
    └── uv/
```

### Production (Packaged)
```
/opt/Qwen Studio/
└── resources/
    └── resources/                # ← Double nesting
        ├── bun/
        │   └── linux-x64/
        │       └── bun-linux-x64/
        │           └── bun
        ├── uv/
        │   └── linux-x64/
        │       └── uv-x86_64-unknown-linux-musl/
        │           ├── uv
        │           └── uvx
        └── qwen-core/
            ├── src/
            │   └── index.ts
            ├── skills/
            │   ├── autonomous-agent/
            │   ├── tdd/
            │   ├── git/
            │   └── security-review/
            └── package.json
```

---

## 🔍 Debugging

### Check Path Resolution

Add to `src/main/index.ts`:
```typescript
console.log("[Debug] qwen-core path:", getQwenCorePath());
console.log("[Debug] Is packaged:", app.isPackaged);
console.log("[Debug] Resources path:", process.resourcesPath);
console.log("[Debug] App path:", app.getAppPath());
```

### View Adapted Config

Add to `src/main/ipc-handlers.ts`:
```typescript
const adapted = deps.adaptConfig(config);
console.log("[IPC] Adapted qwen-core config:", JSON.stringify(adapted["qwen-core"], null, 2));
```

### Check MCP Server Logs

```bash
# In development
tail -f ~/.config/qwen-studio/logs/main.log | grep -i mcp

# In production
journalctl -f -u qwen-studio 2>/dev/null || \
  tail -f ~/.config/qwen-studio/logs/main.log
```

---

## 🛠️ Customization

### Change Qwen-Core Location

If you want to use a different qwen-core location:

**Option 1: Symlink**
```bash
ln -s /path/to/your/qwen-core /opt/Qwen Studio/resources/resources/qwen-core
```

**Option 2: Environment Variable**
```typescript
// In mcp-config.ts
export function getQwenCorePath(): string {
  // Allow override via environment
  const envPath = process.env.QWEN_CORE_PATH;
  if (envPath) return envPath;
  
  // ... existing logic
}
```

Then launch with:
```bash
QWEN_CORE_PATH=/custom/path/qwen-core/src/index.ts qwen-studio
```

### Add Custom Environment Variables

```typescript
// In index.ts getDefaultMcpConfig()
"qwen-core": {
  ...getDefaultQwenCoreConfig(),
  env: {
    ...getDefaultQwenCoreConfig().env,
    MCP_ALLOWED_DIRS: "/home,/tmp,/custom/path",
    MCP_TIMEOUT: "120000",
    DEBUG_MCP: "true",
  },
}
```

---

## 📊 Comparison: Before vs After

### Before (Hardcoded Path)
```typescript
const qwenCorePath = path.join(__dirname, "../../qwen-core/src/index.ts");

return {
  "qwen-core": {
    command: bunPath,
    args: ["tsx", qwenCorePath],
  }
};
```

**Problems:**
- ❌ Only works in development
- ❌ Breaks in production (wrong path)
- ❌ No flexibility for custom locations

### After (Dynamic Resolution)
```typescript
return {
  "qwen-core": getDefaultQwenCoreConfig()
};
```

**Benefits:**
- ✅ Works in both dev and production
- ✅ Auto-detects correct path
- ✅ Supports environment variable override
- ✅ Cleaner, more maintainable

---

## ✅ Checklist for Successful Integration

- [x] `getQwenCorePath()` resolves correctly in dev mode
- [x] `getQwenCorePath()` resolves correctly in production
- [x] `adaptConfig()` replaces bun command with bundled path
- [x] `adaptConfig()` updates args for production
- [x] `getDefaultQwenCoreConfig()` returns valid config
- [x] `electron-builder.yml` includes qwen-core files
- [x] `electron-builder.yml` excludes unnecessary files
- [x] Default config auto-adds qwen-core if missing
- [x] TypeScript compiles without errors
- [x] MCP server starts successfully

---

## 🆘 Troubleshooting

### "Cannot find module 'qwen-core/src/index.ts'"

**Cause:** Path resolution failing

**Fix:**
1. Check `app.isPackaged` value
2. Verify file exists at resolved path
3. Check permissions: `ls -la /path/to/qwen-core/src/index.ts`

### "bun: command not found"

**Cause:** Bundled bun not found

**Fix:**
1. Check `getBunPath()` output
2. Verify bun exists: `ls -la /path/to/resources/bun/...`
3. Ensure executable: `chmod +x /path/to/bun`

### MCP Server Won't Start

**Debug Steps:**
1. Check main process logs
2. Verify adapted config: `console.log(adapted["qwen-core"])`
3. Test manually:
   ```bash
   /path/to/bun tsx /path/to/qwen-core/src/index.ts
   ```

---

## 📚 Related Files

- `src/main/mcp-config.ts` - Path resolution and config adaptation
- `src/main/index.ts` - Default MCP config
- `src/main/runtime.ts` - Bundled runtime paths
- `src/main/ipc-handlers.ts` - MCP config IPC handlers
- `electron-builder.yml` - Build configuration
- `qwen-core/src/index.ts` - Qwen-Core MCP server entry point

---

**For more information:** See `INTEGRATION_GUIDE.md` in qwen-core repository.
