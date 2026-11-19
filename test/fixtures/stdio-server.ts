import { z } from 'zod';
import { defineServer, defineTool } from '../../src/index.js';
import { apiKeys } from '../../src/auth/index.js';
import { serveStdio } from '../../src/runtime/stdio.js';

const withAuth = process.env.FIXTURE_AUTH === '1';

const server = defineServer({
  name: 'stdio-fixture',
  version: '1.0.0',
  logLevel: 'debug',
  tools: [
    defineTool({
      name: 'add',
      description: 'Add two numbers',
      input: z.object({ a: z.number(), b: z.number() }),
      output: z.object({ sum: z.number() }),
      handler: ({ a, b }) => ({ sum: a + b }),
    }),
    defineTool({ name: 'whoami', description: 'Caller id', handler: (_i, ctx) => ctx.principal.id }),
  ],
  ...(withAuth
    ? { auth: apiKeys({ keys: [{ id: 'cli_user', sha256: '2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b' }] }) }
    : {}),
});

await serveStdio(server);
