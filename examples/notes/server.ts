import { z } from 'zod';
import { createTool, defineServer, ToolError } from 'mcp-starter-kit';
import { kinde } from 'mcp-starter-kit/auth';
import { quota } from 'mcp-starter-kit/billing';
import { openrouter } from 'mcp-starter-kit/llm';
import { memoryStore } from 'mcp-starter-kit/store';

interface Note {
  id: string;
  owner: string;
  title: string;
  body: string;
}

const db = new Map<string, Note>();

const repo = (owner: string) => ({
  list: () => [...db.values()].filter((n) => n.owner === owner),
  get: (id: string) => {
    const note = db.get(id);
    return note?.owner === owner ? note : undefined;
  },
  save: (note: Omit<Note, 'owner'>) => {
    const saved = { ...note, owner };
    db.set(note.id, saved);
    return saved;
  },
  remove: (id: string) => db.get(id)?.owner === owner && db.delete(id),
});

const tool = createTool<{ notes: ReturnType<typeof repo> }>();

const NoteSchema = z.object({ id: z.string(), title: z.string(), body: z.string() });

export const server = defineServer({
  name: 'notes',
  version: '1.0.0',
  instructions: 'Notes belong to the signed-in user. Search before creating to avoid duplicates.',
  publicUrl: process.env.MCP_PUBLIC_URL ?? 'http://localhost:3000/mcp',
  auth: kinde({ domain: process.env.KINDE_DOMAIN!, audience: process.env.MCP_PUBLIC_URL ?? 'http://localhost:3000/mcp' }),
  store: memoryStore(),
  entitlements: quota({
    plans: { free: { units: 50, per: 'month' }, pro: { units: Infinity } },
    upgradeUrl: 'https://notes.example.com/billing',
  }),
  ...(process.env.OPENROUTER_API_KEY
    ? { llm: openrouter({ apiKey: process.env.OPENROUTER_API_KEY, defaultModel: 'anthropic/claude-haiku-4.5' }) }
    : {}),
  services: (principal) => ({ notes: repo(principal.id) }),
  tools: [
    tool({
      name: 'search_notes',
      title: 'Search notes',
      description: 'Find notes whose title or body contains the query.',
      input: z.object({ query: z.string().min(1) }),
      output: z.object({ notes: z.array(NoteSchema) }),
      annotations: { readOnlyHint: true },
      scopes: ['notes:read'],
      cost: 0,
      handler: ({ query }, ctx) => {
        const q = query.toLowerCase();
        return { notes: ctx.services.notes.list().filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q)) };
      },
    }),
    tool({
      name: 'create_note',
      title: 'Create note',
      description: 'Save a new note.',
      input: z.object({ title: z.string().min(1).max(200), body: z.string().max(20_000) }),
      output: NoteSchema,
      scopes: ['notes:write'],
      rateLimit: { limit: 30, window: '1m' },
      handler: ({ title, body }, ctx) => {
        if (ctx.services.notes.list().some((n) => n.title === title)) throw new ToolError(`A note titled "${title}" already exists.`);
        return ctx.services.notes.save({ id: crypto.randomUUID(), title, body });
      },
    }),
    tool({
      name: 'summarize_note',
      title: 'Summarize note',
      description: 'Summarize a note in three sentences.',
      input: z.object({ id: z.string() }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      scopes: ['notes:read'],
      cost: 5,
      handler: async ({ id }, ctx) => {
        const note = ctx.services.notes.get(id);
        if (!note) throw new ToolError(`No note with id ${id}.`);
        const { text } = await ctx.llm.chat({
          messages: [
            { role: 'system', content: 'Summarize the note in three sentences.' },
            { role: 'user', content: note.body },
          ],
          signal: ctx.signal,
        });
        return text;
      },
    }),
    tool({
      name: 'delete_note',
      title: 'Delete note',
      description: 'Delete a note permanently.',
      input: z.object({ id: z.string() }),
      annotations: { destructiveHint: true, idempotentHint: true },
      scopes: ['notes:write'],
      confirm: ({ id }) => `Delete note ${id}? This cannot be undone.`,
      handler: ({ id }, ctx) => {
        if (!ctx.services.notes.remove(id)) throw new ToolError(`No note with id ${id}.`);
        return `Deleted ${id}.`;
      },
    }),
  ],
});
