import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { createTool, defineTool, type ToolContext } from '../src/index.js';

describe('tool types', () => {
  it('keeps literal and enum output types for handlers that take input', () => {
    const t = defineTool({
      name: 'publish',
      description: 'Publish a draft',
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), status: z.enum(['draft', 'published']), tags: z.array(z.string()) }),
      handler: async ({ id }) => ({ id, status: 'published', tags: ['news'] }),
    });
    expectTypeOf(t.name).toEqualTypeOf<string>();
  });

  it('types services from createTool', () => {
    const tool = createTool<{ db: { count(): number } }>();
    tool({
      name: 'count',
      description: 'Count rows',
      handler: (_input, ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<ToolContext<{ db: { count(): number } }>>();
        return String(ctx.services.db.count());
      },
    });
  });
});
