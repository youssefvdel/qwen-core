# 📦 Publishing qwen-core-mcp to npm

## Current Status

✅ Package configured as `qwen-core-mcp@2.0.0`  
✅ All source files ready in `/Projects/qwen-core/`  
✅ Package.json updated with correct metadata  
❌ Not logged in to npm  

---

## Step 1: Login to npm

```bash
npm login
```

You'll be prompted for:
- **Username:** Your npm username
- **Password:** Your npm password
- **Email:** Your email address

If you don't have an npm account, create one at https://www.npmjs.com/signup

---

## Step 2: Verify Login

```bash
npm whoami
# Should output your username
```

---

## Step 3: Publish Package

```bash
cd /Projects/qwen-core
npm publish --access public
```

**Expected output:**
```
npm notice 📦  qwen-core-mcp@2.0.0
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access
+ qwen-core-mcp@2.0.0
```

---

## Step 4: Verify Publication

Visit: https://www.npmjs.com/package/qwen-core-mcp

Or check via CLI:
```bash
npm view qwen-core-mcp
```

---

## Step 5: Update qwen-studio MCP Config

Once published, update qwen-studio config to use the npm package:

### Option A: Via npx (recommended for testing)
```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["-y", "qwen-core-mcp"],
      "env": {
        "MCP_ALLOWED_DIRS": "/home/user,/tmp",
        "MCP_TIMEOUT": "60000"
      }
    }
  }
}
```

### Option B: Install globally
```bash
npm install -g qwen-core-mcp
```

Then config:
```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "qwen-core-mcp",
      "env": {
        "MCP_ALLOWED_DIRS": "/home/user,/tmp",
        "MCP_TIMEOUT": "60000"
      }
    }
  }
}
```

---

## Troubleshooting

### Error: "404 Not Found"
You're not logged in. Run:
```bash
npm login
```

### Error: "Cannot publish over existing version"
Bump version:
```bash
npm version patch  # 2.0.0 → 2.0.1
npm publish --access public
```

### Error: "name already taken"
The package name `qwen-core-mcp` is already registered. Try:
- `qwen-core-mcp-server`
- `@yourusername/qwen-core` (scoped package)

### Build Errors
The agent folder has TypeScript errors but doesn't affect runtime (uses tsx). To fix:
```bash
npm install chalk js-yaml
```

Or ignore typecheck errors in prepublishOnly script.

---

## Alternative: Install from Git

If npm publishing fails, users can install directly from GitHub:

```bash
npm install git+https://github.com/youssefvdel/qwen-core.git
```

Config:
```json
{
  "mcpServers": {
    "qwen-core": {
      "command": "npx",
      "args": ["tsx", "node_modules/qwen-core/src/index.ts"],
      "env": {
        "MCP_ALLOWED_DIRS": "/home/user,/tmp"
      }
    }
  }
}
```

---

## Testing Locally Before Publish

```bash
cd /Projects/qwen-core
npm start
# Should output:
# 🌐 qwen-core v2.0.0 starting...
# ✅ Ready - 39 tools + 3 prompts loaded
```

Test with MCP client:
```bash
npx tsx src/index.ts < /dev/null
```

---

## Next Steps After Publish

1. **Update qwen-studio** to use npm package
2. **Test MCP connection** in qwen-studio
3. **Document installation** in qwen-studio README
4. **Monitor npm downloads** at https://www.npmjs.com/package/qwen-core-mcp

---

**Package Details:**
- **Name:** qwen-core-mcp
- **Version:** 2.0.0
- **Size:** ~57KB (215KB unpacked)
- **Files:** 27 (src, skills, README, LICENSE, package.json)
- **Dependencies:** 8 (MCP SDK, execa, fast-glob, etc.)
