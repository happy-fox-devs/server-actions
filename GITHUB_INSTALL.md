# GitHub Installation Guide

## Installing from GitHub

This library is optimized for direct GitHub installation. Install it in your projects with:

```bash
# Using pnpm (recommended)
pnpm add github:happy-fox-devs/server-actions

# Using npm
npm install github:happy-fox-devs/server-actions

# Using yarn
yarn add github:happy-fox-devs/server-actions

# Specific version/tag
pnpm add github:happy-fox-devs/server-actions#v0.1.0-beta.1

# Specific branch
pnpm add github:happy-fox-devs/server-actions#main
```

## What You Get

When you install from GitHub, you get:

- ✅ **Pre-built optimized code** (4.3KB minified + gzipped)
- ✅ **Full TypeScript types** (9.2KB type definitions)
- ✅ **Both CommonJS and ESM** formats
- ✅ **Source maps** for debugging
- ✅ **Tree-shaking support** for smaller bundles

## Build Information

The repository includes pre-built files in the `dist/` directory:

```
dist/
├── index.js          # CommonJS build (minified)
├── index.js.map      # Source map for CommonJS
├── index.mjs         # ESM build (minified)
├── index.mjs.map     # Source map for ESM
├── index.d.ts        # TypeScript types for CommonJS
└── index.d.mts       # TypeScript types for ESM
```

## Usage After Installation

```tsx
// Import the library
import {
  useSAR,
  serverActionRequest,
  objectToFormData,
  withFormTransform,
} from "@happy-fox/server-actions";

// Use in your components
function MyComponent() {
  const { data, execute, loading } = useSAR({
    action: myServerAction,
    cacheTime: 5000,
  });

  return <div>{loading ? "Loading..." : JSON.stringify(data)}</div>;
}
```

## Development Workflow

If you want to contribute or modify the library:

1. **Clone the repository**

```bash
git clone https://github.com/happy-fox-devs/server-actions.git
cd server-actions
pnpm install
```

2. **Development mode**

```bash
pnpm run dev    # Watch mode with auto-rebuild
```

3. **Build for production**

```bash
pnpm run prepare-github    # Full verification and build
```

4. **Type checking**

```bash
pnpm run typecheck
```

## Bundle Analysis

The library is optimized for minimal bundle size:

| Format | Size  | Gzipped |
| ------ | ----- | ------- |
| ESM    | 4.2KB | ~1.5KB  |
| CJS    | 4.3KB | ~1.5KB  |
| Types  | 9.2KB | N/A     |

## Compatibility

- **Node.js**: ≥18.0.0
- **React**: ≥18.2.0
- **TypeScript**: ≥4.7.0
- **Next.js**: ≥13.4.0 (Server Actions support)

## GitHub Installation Benefits

Installing from GitHub gives you:

- 🚀 **Faster installation** (no npm registry delay)
- 🔒 **Version control** (pin to specific commits)
- 🔄 **Direct updates** from source
- 📦 **Pre-built bundles** (no build step needed)
- 🎯 **Development versions** (install from branches)
