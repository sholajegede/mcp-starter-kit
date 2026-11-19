import { listen } from 'mcp-starter-kit/node';
import { server } from './server.js';

await listen(server, { port: 3000 });
