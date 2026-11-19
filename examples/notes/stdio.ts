import { serveStdio } from 'mcp-starter-kit/stdio';
import { server } from './server.js';

await serveStdio(server);
