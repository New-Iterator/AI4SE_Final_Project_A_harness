### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/index.ts`

**Interfaces:**
- Produces: `package.json` with all dependencies declared, `tsconfig.json` with strict mode, `vitest.config.ts` ready for testing

- [ ] **Step 1: Initialize git repo**

```bash
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "coding-agent-harness",
  "version": "1.0.0",
  "description": "A Coding Agent Harness that enables AI to autonomously modify code, run tests, and self-correct",
  "main": "dist/index.js",
  "bin": { "harness": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "demo:guard": "npx tsx demos/guard-demo.ts",
    "demo:feedback": "npx tsx demos/feedback-demo.ts",
    "demo:memory": "npx tsx demos/memory-demo.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "keytar": "^7.9.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "tsx": "^4.7.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "demos"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.harness/
.env
*.db
*.db-journal
```

- [ ] **Step 6: Create placeholder src/index.ts**

```typescript
#!/usr/bin/env node
console.log('Coding Agent Harness');
```

- [ ] **Step 7: Install dependencies and verify**

```bash
npm install
```

- [ ] **Step 8: Run build to verify**

```bash
npm run build
```
Expected: compiles without errors, `dist/index.js` created.

- [ ] **Step 9: Run tests to verify vitest works**

```bash
npm test
```
Expected: "No test files found" or passes.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: scaffold project with TypeScript, Vitest, dependencies"
```

---


