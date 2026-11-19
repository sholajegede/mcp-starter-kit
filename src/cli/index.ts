import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { AUTH, BILLING, DEFAULTS, isChoice, LLM, RUNTIME, STORE, validateOptions, type ProjectOptions } from './choices.js';
import { generateProject, toolFile } from './generate.js';

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')) as { version: string };

const HELP = `mcp-starter-kit ${pkg.version}

Usage
  npx mcp-starter-kit [init] [directory] [options]
  npx mcp-starter-kit add tool <name>

Init options
  --auth      ${AUTH.map((c) => c.value).join(' | ')}
  --store     ${STORE.map((c) => c.value).join(' | ')}
  --billing   ${BILLING.map((c) => c.value).join(' | ')}
  --llm       ${LLM.map((c) => c.value).join(' | ')}
  --runtime   ${RUNTIME.map((c) => c.value).join(' | ')}
  --yes, -y   Use defaults for anything not passed, without prompts
  --no-install  Skip installing dependencies

Examples
  npx mcp-starter-kit my-server
  npx mcp-starter-kit my-server --auth workos --store postgres --billing stripe --runtime cloudflare -y
  npx mcp-starter-kit add tool create_invoice
`;

function packageManager(): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  return 'npm';
}

function run(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, stdio: 'ignore', shell: process.platform === 'win32' });
    child.on('close', (code) => done(code ?? 1));
    child.on('error', () => done(1));
  });
}

function bail(message: string): never {
  p.cancel(message);
  process.exit(1);
}

async function select<T extends string>(message: string, options: readonly { value: T; label: string; hint?: string }[], initialValue: T): Promise<T> {
  const value = await p.select({ message, options: options as never, initialValue });
  if (p.isCancel(value)) bail('Cancelled.');
  return value as T;
}

async function init(positionals: string[], flags: Record<string, string | boolean | undefined>) {
  const interactive = !flags.yes && process.stdin.isTTY;
  p.intro(`mcp-starter-kit ${pkg.version}`);

  let dir = positionals[0];
  if (!dir) {
    if (!interactive) dir = 'my-mcp-server';
    else {
      const answer = await p.text({ message: 'Project name', placeholder: 'my-mcp-server', defaultValue: 'my-mcp-server' });
      if (p.isCancel(answer)) bail('Cancelled.');
      dir = answer;
    }
  }
  const target = resolve(dir);
  const name = basename(target).toLowerCase().replace(/[^a-z0-9-_.]/g, '-');
  if (existsSync(target) && (await readdir(target)).length) bail(`${target} already exists and is not empty.`);

  const pick = async <T extends string>(key: string, message: string, list: readonly { value: T; label: string; hint?: string }[], fallback: T, filter?: (v: T) => boolean): Promise<T> => {
    const given = flags[key];
    if (given !== undefined) {
      if (!isChoice(list, given)) bail(`--${key} must be one of: ${list.map((c) => c.value).join(', ')}`);
      return given as T;
    }
    if (!interactive) return fallback;
    return select(message, filter ? list.filter((c) => filter(c.value)) : list, fallback);
  };

  const runtime = await pick('runtime', 'Where will it run?', RUNTIME, DEFAULTS.runtime);
  const auth = await pick('auth', 'Who signs users in?', AUTH, DEFAULTS.auth);
  const store = await pick('store', 'Which database?', STORE, runtime === 'cloudflare' ? 'upstash' : DEFAULTS.store, (v) => {
    if (runtime === 'cloudflare') return !['redis', 'mongo', 'memory'].includes(v);
    if (runtime === 'vercel') return v !== 'memory';
    return true;
  });
  const billingFallback = auth === 'none' ? 'none' : auth === 'kinde' ? 'kinde' : DEFAULTS.billing;
  const billing = await pick('billing', 'How do you charge or limit usage?', BILLING, billingFallback, (v) => {
    if (v === 'kinde') return auth === 'kinde';
    if (auth === 'none') return v === 'none';
    return true;
  });
  const llm = await pick('llm', 'Do tools call a model? Pick a router or provider', LLM, DEFAULTS.llm);

  const options: ProjectOptions = { name, runtime, auth, store, billing, llm };
  const invalid = validateOptions(options);
  if (invalid) bail(invalid);

  const spin = p.spinner();
  spin.start('Writing files');
  const files = generateProject(options, pkg.version);
  for (const [path, content] of Object.entries(files)) {
    const full = join(target, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  spin.stop(`Created ${Object.keys(files).length} files in ${target}`);

  const pm = runtime === 'bun' ? 'bun' : packageManager();
  let installed = false;
  if (flags.install !== false && runtime !== 'deno') {
    spin.start(`Installing dependencies with ${pm}`);
    installed = (await run(pm, ['install'], target)) === 0;
    spin.stop(installed ? 'Dependencies installed' : `Install failed. Run ${pm} install in the project.`);
  }

  const steps = [
    `cd ${dir}`,
    'cp .env.example .env    # then fill it in',
    ...(installed || runtime === 'deno' ? [] : [`${pm} install`]),
    ...(auth === 'api-keys' ? ['npm run create-key'] : []),
    `${pm === 'npm' ? 'npm run' : pm} dev`,
  ];
  p.note(steps.join('\n'), 'Next');
  p.outro('The README in your project covers auth setup, connecting clients and deploying.');
}

async function addTool(name: string | undefined) {
  if (!name || !/^[a-z][a-z0-9_]{0,63}$/.test(name)) bail('Give the tool a snake_case name, e.g. `npx mcp-starter-kit add tool create_invoice`.');
  const index = resolve('src/tools/index.ts');
  if (!existsSync(index)) bail('Run this inside a project created with mcp-starter-kit (src/tools/index.ts was not found).');
  const { path, exportName, content } = toolFile(name);
  if (existsSync(resolve(path))) bail(`${path} already exists.`);
  const source = await readFile(index, 'utf8');
  if (!source.includes('// mcp-starter-kit:imports') || !source.includes('// mcp-starter-kit:tools')) {
    bail('src/tools/index.ts is missing the mcp-starter-kit markers. Add the import and the array entry by hand.');
  }
  await writeFile(resolve(path), content);
  await writeFile(
    index,
    source
      .replace('// mcp-starter-kit:imports', `import { ${exportName} } from './${basename(path, '.ts')}.js';\n// mcp-starter-kit:imports`)
      .replace('  // mcp-starter-kit:tools', `  ${exportName},\n  // mcp-starter-kit:tools`),
  );
  p.log.success(`Created ${path} and registered ${name} in src/tools/index.ts`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      auth: { type: 'string' },
      store: { type: 'string' },
      billing: { type: 'string' },
      llm: { type: 'string' },
      runtime: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      install: { type: 'boolean' },
      'no-install': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (values.help) return void process.stdout.write(HELP);
  if (values.version) return void process.stdout.write(`${pkg.version}\n`);
  const flags: Record<string, string | boolean | undefined> = { ...values };
  if (values['no-install']) flags.install = false;

  const [command, ...rest] = positionals;
  if (command === 'add') {
    if (rest[0] !== 'tool') bail('Usage: npx mcp-starter-kit add tool <name>');
    return addTool(rest[1]);
  }
  if (command === 'init') return init(rest, flags);
  return init(positionals, flags);
}

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
