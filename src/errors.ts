/**
 * An error the model should see. Thrown from a tool handler, it becomes an
 * `isError` tool result carrying `message`, so the model can correct itself.
 * Any other thrown error is logged and replaced with a generic message, so
 * internals never leak to the client.
 */
export class ToolError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: { code?: string; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'ToolError';
    this.code = options.code ?? 'tool_error';
    if (options.details) this.details = options.details;
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class AuthError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'AuthError';
  }
}
