import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'auth/index': 'src/auth/index.ts',
    'store/index': 'src/store/index.ts',
    'billing/index': 'src/billing/index.ts',
    'llm/index': 'src/llm/index.ts',
    'runtime/node': 'src/runtime/node.ts',
    'runtime/stdio': 'src/runtime/stdio.ts',
  },
  format: ['esm'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  external: ['@modelcontextprotocol/server', '@modelcontextprotocol/node', 'zod', 'jose'],
});
