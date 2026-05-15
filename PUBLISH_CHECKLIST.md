# 📦 npm Publish Checklist for qwen-core

## ✅ Done

- [x] Package name: `@qwen-studio/qwen-core`
- [x] Version: 2.0.0
- [x] Repository URL configured
- [x] License: MIT
- [x] Keywords added
- [x] Bin entry added (`qwen-core`)
- [x] Files field (dist, README, LICENSE)
- [x] Engines: node >= 18
- [x] .gitignore updated

## ⚠️ Issues Found

### 1. Agent Folder Dependencies
The `src/agent/` folder has dependencies on:
- `electron` (qwen-studio specific)
- `js-yaml` (missing from deps)
- `../main/logger.js` (doesn't exist in standalone)

**Solution:** Exclude `agent/` from build - it's qwen-studio specific logic

### 2. Build Errors in Tools
Some tools reference missing dependencies:
- `chalk` (missing from deps)
- Registration pattern issues

### 3. Monolithic index.ts
2421 lines - includes everything (agent, tools, prompts)

## 🔧 Options

### Option A: Publish Source (Recommended for v2.0.0)
- Keep using `tsx` at runtime (no build step)
- Users install: `npm install @qwen-studio/qwen-core`
- Run with: `npx tsx node_modules/@qwen-studio/qwen-core/src/index.ts`
- **Pros:** No build complexity, works immediately
- **Cons:** Requires tsx, slower startup

### Option B: Build to dist/
- Fix all TypeScript errors
- Remove agent/ folder or make it optional
- Add missing dependencies (chalk, js-yaml)
- Build: `npm run build` → outputs to dist/
- Users run: `npx qwen-core` (uses dist/index.js)
- **Pros:** Faster, no tsx needed
- **Cons:** Need to fix build errors first

### Option C: Hybrid
- Publish both src/ and dist/
- Bin points to src/index.ts (uses tsx)
- Also provide dist/ for those who want compiled
- **Pros:** Best of both worlds
- **Cons:** Larger package size

## 📋 Recommended Next Steps

**For quick publish (Option A):**

1. Update package.json bin to point to src:
   ```json
   "bin": {
     "qwen-core": "./src/index.ts"
   }
   ```

2. Add tsx as peer dependency:
   ```json
   "peerDependencies": {
     "tsx": "^4.19.2"
   }
   ```

3. Publish:
   ```bash
   npm publish --access public
   ```

4. Update qwen-studio to use:
   ```json
   {
     "mcpServers": {
       "qwen-core": {
         "command": "npx",
         "args": ["-y", "@qwen-studio/qwen-core"]
       }
     }
   }
   ```

**For proper build (Option B):**

1. Add missing deps:
   ```bash
   npm install chalk js-yaml
   ```

2. Fix TypeScript errors in tools

3. Remove or stub agent/ folder

4. Build and test:
   ```bash
   npm run build
   node dist/index.js  # Test it works
   ```

5. Publish

---

**Recommendation:** Start with **Option A** for quick publish, then iterate to Option B.
