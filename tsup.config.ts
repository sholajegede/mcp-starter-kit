import { defineConfig } from 'tsup';

const shared = {
  format: 'esm' as const,
  target: 'es2022',
  sourcemap: true,
  treeshake: true,
  external: ['@opentelemetry/api', '@modelcontextprotocol/server', '@modelcontextprotocol/node', 'zod', 'jose', '@clack/prompts'],
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      'auth/index': 'src/auth/index.ts',
      'store/index': 'src/store/index.ts',
      'billing/index': 'src/billing/index.ts',
      'llm/index': 'src/llm/index.ts',
      'runtime/node': 'src/runtime/node.ts',
      'runtime/stdio': 'src/runtime/stdio.ts',
      'otel/index': 'src/otel/index.ts',
    },
    dts: true,
    splitting: true,
  },
  {
    ...shared,
    entry: { 'cli/index': 'src/cli/index.ts' },
    banner: { js: '#!/usr/bin/env node' },
    platform: 'node',
  },
]);
