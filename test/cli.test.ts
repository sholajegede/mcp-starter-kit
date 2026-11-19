import { describe, expect, it } from 'vitest';
import { AUTH, BILLING, LLM, RUNTIME, STORE, validateOptions, type ProjectOptions } from '../src/cli/choices.js';
import { generateProject, toolFile } from '../src/cli/generate.js';

const combos: ProjectOptions[] = [];
for (const runtime of RUNTIME) for (const auth of AUTH) for (const store of STORE) for (const billing of BILLING) for (const llm of LLM) {
  const o = { name: 'demo', runtime: runtime.value, auth: auth.value, store: store.value, billing: billing.value, llm: llm.value };
  if (!validateOptions(o)) combos.push(o);
}

describe('project generator', () => {
  it('produces a project for every valid combination', () => {
    expect(combos.length).toBeGreaterThan(2000);
    for (const o of combos) {
      const files = generateProject(o, '2.0.0');
      expect(files['src/server.ts']).toContain("name: 'demo'");
      expect(JSON.parse(files['package.json']!).dependencies['mcp-starter-kit']).toBe('^2.0.0');
    }
  });

  it('documents every environment variable the code reads', () => {
    for (const o of combos) {
      const files = generateProject(o, '2.0.0');
      const example = files['.env.example']!;
      const source = Object.entries(files).filter(([path]) => path.startsWith('src/') || path.startsWith('api/')).map(([, c]) => c).join('\n');
      const used = new Set([...source.matchAll(/(?:optionalEnv|env)\('([A-Z0-9_]+)'\)/g)].map((m) => m[1]!));
      for (const name of used) expect(example, `${JSON.stringify(o)} reads ${name}`).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
    }
  });

  it('adds runtime-specific entry points', () => {
    const base = { name: 'demo', auth: 'kinde', store: 'postgres', billing: 'quota', llm: 'none' } as const;
    expect(Object.keys(generateProject({ ...base, runtime: 'node' }, '2.0.0'))).toEqual(expect.arrayContaining(['src/http.ts', 'src/stdio.ts', 'Dockerfile']));
    expect(Object.keys(generateProject({ ...base, runtime: 'cloudflare', store: 'upstash' }, '2.0.0'))).toContain('wrangler.jsonc');
    expect(Object.keys(generateProject({ ...base, runtime: 'vercel' }, '2.0.0'))).toEqual(expect.arrayContaining(['api/index.ts', 'vercel.json']));
  });

  it('rejects combinations that cannot work', () => {
    expect(validateOptions({ name: 'x', runtime: 'cloudflare', auth: 'kinde', store: 'redis', billing: 'none', llm: 'none' })).toMatch(/Upstash/);
    expect(validateOptions({ name: 'x', runtime: 'node', auth: 'auth0', store: 'memory', billing: 'kinde', llm: 'none' })).toMatch(/Kinde auth/);
    expect(validateOptions({ name: 'Bad Name', runtime: 'node', auth: 'none', store: 'memory', billing: 'none', llm: 'none' })).toMatch(/npm package name/);
  });

  it('scaffolds a tool file with a camelCase export', () => {
    const t = toolFile('create_invoice');
    expect(t).toMatchObject({ path: 'src/tools/create-invoice.ts', exportName: 'createInvoice' });
    expect(t.content).toContain("name: 'create_invoice'");
  });
});
