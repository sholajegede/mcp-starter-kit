/**
 * CLI Tool for Creating New MCP Applications
 * Generates complete, working MCP projects
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface AppTemplate {
  name: string;
  description: string;
  entities: string[];
  features: string[];
}

export const APP_TEMPLATES: Record<string, AppTemplate> = {
  'blog': {
    name: 'Blog Application',
    description: 'A blog management system with posts and comments',
    entities: ['posts', 'comments'],
    features: ['authentication', 'billing', 'crud']
  },
  'ecommerce': {
    name: 'E-commerce Application',
    description: 'An e-commerce system with products and orders',
    entities: ['products', 'orders', 'order_items'],
    features: ['authentication', 'billing', 'crud']
  },
  'crm': {
    name: 'CRM Application',
    description: 'A customer relationship management system',
    entities: ['contacts', 'deals', 'tasks'],
    features: ['authentication', 'billing', 'crud']
  },
  'todo': {
    name: 'Todo Application',
    description: 'A simple todo management system',
    entities: ['todos'],
    features: ['authentication', 'billing', 'crud']
  }
};

export class AppGenerator {
  private projectPath: string;
  private appName: string;

  constructor(projectPath: string, appName: string) {
    this.projectPath = projectPath;
    this.appName = appName;
  }

  /**
   * Generate a complete MCP application
   */
  async generateApp(template: string): Promise<void> {
    const appTemplate = APP_TEMPLATES[template];
    if (!appTemplate) {
      throw new Error(`Unknown template: ${template}`);
    }

    console.log(`🚀 Creating ${appTemplate.name}...`);
    console.log(`📁 Project path: ${this.projectPath}`);
    console.log(`📋 Entities: ${appTemplate.entities.join(', ')}`);

    // Create project directory
    if (!existsSync(this.projectPath)) {
      mkdirSync(this.projectPath, { recursive: true });
    }

    // Generate complete project structure
    await this.generateProjectStructure(template, appTemplate);
    
    console.log('✅ Application generated successfully!');
    console.log('📦 Installing dependencies...');
    
    // Auto-install dependencies
    const { spawn } = await import('child_process');
    const installProcess = spawn('npm', ['install'], { 
      cwd: this.projectPath, 
      stdio: 'inherit' 
    });
    
    await new Promise((resolve, reject) => {
      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed successfully!');
          console.log('📋 Next steps:');
          console.log('1. cd ' + this.projectPath);
          console.log('2. Copy .env.example to .env and configure');
          console.log('3. npm run setup-db');
          console.log('4. npm run dev');
          resolve(void 0);
        } else {
          console.log('⚠️ Dependencies installation failed, but project created.');
          console.log('📋 Next steps:');
          console.log('1. cd ' + this.projectPath);
          console.log('2. npm install');
          console.log('3. Copy .env.example to .env and configure');
          console.log('4. npm run setup-db');
          console.log('5. npm run dev');
          resolve(void 0);
        }
      });
    });
  }

  private async generateProjectStructure(template: string, appTemplate: AppTemplate): Promise<void> {
    // Create directories
    const srcDir = join(this.projectPath, 'src');
    const distDir = join(this.projectPath, 'dist');
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });

    // Generate package.json
    await this.generatePackageJson();
    
    // Generate tsconfig.json
    await this.generateTsConfig();
    
    // Generate .env.example
    await this.generateEnvTemplate();
    
    // Generate README
    await this.generateReadme(appTemplate);
    
    // Generate core files
    await this.generateCoreFiles();
    
    // Generate app-specific files
    await this.generateAppFiles(template, appTemplate);
    
    // Generate setup script
    await this.generateSetupScript();
  }

  private async generatePackageJson(): Promise<void> {
    const packageJson = {
      name: this.appName,
      version: '1.0.0',
      description: 'Generated MCP application',
      main: 'dist/universal-server.js',
      type: 'module',
      scripts: {
        build: 'tsc',
        start: 'node dist/universal-server.js',
        dev: 'tsx src/universal-server.ts',
        'auth-server': 'tsx src/kinde-auth-server.ts',
        'setup-db': 'tsx src/setup-db.ts'
      },
      dependencies: {
        '@kinde-oss/kinde-typescript-sdk': '^2.13.0',
        '@modelcontextprotocol/sdk': '^1.19.0',
        '@neondatabase/serverless': '^0.9.0',
        'dotenv': '^16.3.1',
        'express': '^4.21.2',
        'express-session': '^1.18.2',
        'jsonwebtoken': '^9.0.2',
        'jwks-client': '^2.0.5'
      },
      devDependencies: {
        '@types/express': '^5.0.3',
        '@types/express-session': '^1.18.2',
        '@types/jsonwebtoken': '^9.0.5',
        '@types/node': '^20.0.0',
        'tsx': '^4.0.0',
        'typescript': '^5.0.0'
      }
    };

    writeFileSync(
      join(this.projectPath, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
  }

  private async generateTsConfig(): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', '**/*.test.ts']
    };

    writeFileSync(
      join(this.projectPath, 'tsconfig.json'), 
      JSON.stringify(tsConfig, null, 2)
    );
  }

  private async generateEnvTemplate(): Promise<void> {
    const envContent = `# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Kinde Authentication
KINDE_ISSUER_URL=https://your-domain.kinde.com
KINDE_CLIENT_ID=your_client_id
KINDE_CLIENT_SECRET=your_client_secret

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Server Configuration
NODE_ENV=development
APP_TYPE=${this.appName}
`;

    writeFileSync(join(this.projectPath, '.env.example'), envContent);
  }

  private async generateReadme(appTemplate: AppTemplate): Promise<void> {
    const readmeContent = `# ${appTemplate.name}

${appTemplate.description}

## Features

- ✅ Authentication with Kinde
- ✅ Database with Neon PostgreSQL
- ✅ Billing system with free tier
- ✅ MCP protocol integration
- ✅ CRUD operations for: ${appTemplate.entities.join(', ')}

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your credentials
   \`\`\`

3. Setup database:
   \`\`\`bash
   npm run setup-db
   \`\`\`

4. Start the server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Available Tools

${this.generateToolsList(appTemplate.entities)}

## Configuration

Edit \`src/app-config.ts\` to customize your application.
`;

    writeFileSync(join(this.projectPath, 'README.md'), readmeContent);
  }

  private async generateCoreFiles(): Promise<void> {
    // Copy core directory from source
    const coreSourceDir = join(process.cwd(), 'src/core');
    const coreDestDir = join(this.projectPath, 'src/core');
    
    if (existsSync(coreSourceDir)) {
      this.copyDirectory(coreSourceDir, coreDestDir);
    } else {
      // Generate core files if source doesn't exist
      await this.generateAuthModule();
      await this.generateDatabaseModule();
      await this.generateServerModule();
      await this.generateToolsModule();
    }
    await this.generateKindeAuthServer();
  }

  private copyDirectory(src: string, dest: string): void {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    
    const items = readdirSync(src);
    for (const item of items) {
      const srcPath = join(src, item);
      const destPath = join(dest, item);
      
      if (statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  private async generateAuthModule(): Promise<void> {
    const authContent = `/**
 * Authentication Manager
 * Handles Kinde authentication and JWT verification
 */

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-client';

export interface AuthConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  logoutRedirectUrl: string;
  jwtSecret: string;
}

export class AuthManager {
  private sql: any;
  private jwksClient: any;

  constructor(config: AuthConfig) {
    this.sql = neon(process.env.DATABASE_URL!);
    
    this.jwksClient = jwksClient({
      jwksUri: \`\${config.issuerUrl}/.well-known/jwks.json\`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid token format');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getBillingStatus(userId: string, accessToken: string): Promise<{ plan: string; features: any; canCreate: boolean; reason?: string }> {
    try {
      const decoded = jwt.decode(accessToken) as any;
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid token format');
      }
      
      const subscription = await this.sql\`
        SELECT * FROM users 
        WHERE user_id = \${userId}
      \`;

      if (subscription.length === 0) {
        await this.sql\`
          INSERT INTO users (user_id, name, email, subscription_status, plan, free_todos_used)
          VALUES (\${userId}, \${decoded.given_name || decoded.name || 'User'}, \${decoded.email || 'user@example.com'}, 'free', 'free', 0)
        \`;
      }

      const freeTodosUsed = subscription.length > 0 ? subscription[0].free_todos_used : 0;
      
      if (freeTodosUsed < 10) {
        return {
          plan: 'free',
          features: { maxTodos: 10, used: freeTodosUsed },
          canCreate: true,
          reason: \`Free tier - \${10 - freeTodosUsed} items remaining\`
        };
      }
      
      return {
        plan: 'free',
        features: { maxTodos: 10, used: freeTodosUsed },
        canCreate: false,
        reason: 'You have used your free items. Please upgrade your plan to create more.'
      };
    } catch (error) {
      console.error('Error checking billing:', error);
      return {
        plan: 'free',
        features: { maxTodos: 10 },
        canCreate: false,
        reason: 'Error checking billing status'
      };
    }
  }
}
`;

    const authDir = join(this.projectPath, 'src/core/auth');
    mkdirSync(authDir, { recursive: true });
    writeFileSync(join(authDir, 'index.ts'), authContent);
  }

  private async generateDatabaseModule(): Promise<void> {
    const databaseContent = `/**
 * Database Manager
 * Handles database operations and schema management
 */

import { neon } from '@neondatabase/serverless';

export interface EntityConfig {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    defaultValue?: any;
  }>;
  indexes?: string[];
}

export class DatabaseManager {
  private sql: any;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async setupDatabase(entities: EntityConfig[]): Promise<void> {
    // Create users table
    await this.sql\`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        name TEXT,
        email TEXT,
        subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'cancelled')),
        plan TEXT DEFAULT 'free',
        free_todos_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`;

    // Create entity tables
    for (const entity of entities) {
      await this.createEntityTable(entity);
    }
  }

  private async createEntityTable(entity: EntityConfig): Promise<void> {
    const fields = entity.fields.map(field => {
      let fieldDef = \`\${field.name} \${this.getSqlType(field.type)}\`;
      if (field.required) fieldDef += ' NOT NULL';
      if (field.defaultValue !== undefined) {
        fieldDef += \` DEFAULT \${field.defaultValue === 'CURRENT_TIMESTAMP' ? 'CURRENT_TIMESTAMP' : \`'\${field.defaultValue}'\`}\`;
      }
      return fieldDef;
    }).join(', ');

    // Check if created_at and updated_at are already defined in entity fields
    const hasCreatedAt = entity.fields.some(field => field.name === 'created_at');
    const hasUpdatedAt = entity.fields.some(field => field.name === 'updated_at');

    let additionalFields = '';
    if (!hasCreatedAt) {
      additionalFields += ', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    }
    if (!hasUpdatedAt) {
      additionalFields += ', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    }

    const createTableSQL = \`
      CREATE TABLE IF NOT EXISTS \${entity.name} (
        id SERIAL PRIMARY KEY,
        \${fields},
        user_id TEXT NOT NULL\${additionalFields}
      )
    \`;

    await this.sql(createTableSQL);

    // Create indexes
    if (entity.indexes) {
      for (const index of entity.indexes) {
        await this.sql(index);
      }
    }
  }

  private getSqlType(type: string): string {
    switch (type) {
      case 'string': return 'TEXT';
      case 'text': return 'TEXT';
      case 'number': return 'INTEGER';
      case 'boolean': return 'BOOLEAN';
      case 'timestamp': return 'TIMESTAMP';
      default: return 'TEXT';
    }
  }

  async create(entityName: string, data: any, userId: string): Promise<any> {
    const result = await this.sql\`
      INSERT INTO \${entityName} (\${Object.keys(data).join(', ')}, user_id)
      VALUES (\${Object.values(data).join(', ')}, \${userId})
      RETURNING *
    \`;
    return result[0];
  }

  async list(entityName: string, userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    return await this.sql\`
      SELECT * FROM \${entityName}
      WHERE user_id = \${userId}
      ORDER BY created_at DESC
      LIMIT \${limit} OFFSET \${offset}
    \`;
  }

  async get(entityName: string, id: number, userId: string): Promise<any> {
    const result = await this.sql\`
      SELECT * FROM \${entityName}
      WHERE id = \${id} AND user_id = \${userId}
    \`;
    return result[0];
  }

  async update(entityName: string, id: number, data: any, userId: string): Promise<any> {
    const setClause = Object.keys(data).map(key => \`\${key} = \${data[key]}\`).join(', ');
    const result = await this.sql\`
      UPDATE \${entityName}
      SET \${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = \${id} AND user_id = \${userId}
      RETURNING *
    \`;
    return result[0];
  }

  async delete(entityName: string, id: number, userId: string): Promise<boolean> {
    const result = await this.sql\`
      DELETE FROM \${entityName}
      WHERE id = \${id} AND user_id = \${userId}
    \`;
    return result.length > 0;
  }
}
`;

    const databaseDir = join(this.projectPath, 'src/core/database');
    mkdirSync(databaseDir, { recursive: true });
    writeFileSync(join(databaseDir, 'index.ts'), databaseContent);
  }

  private async generateServerModule(): Promise<void> {
    const serverContent = `/**
 * Universal MCP Server
 * Configurable MCP server that can handle any entity configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AuthManager, AuthConfig } from '../auth/index.js';
import { DatabaseManager, EntityConfig } from '../database/index.js';
import { ToolFactory, ToolDefinition } from '../tools/index.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Token storage functions
const TOKEN_FILE = join(process.cwd(), '.auth-token');

function saveToken(token: string): void {
  writeFileSync(TOKEN_FILE, token);
}

function getStoredToken(): string | null {
  if (existsSync(TOKEN_FILE)) {
    return readFileSync(TOKEN_FILE, 'utf8');
  }
  return null;
}

function clearToken(): void {
  if (existsSync(TOKEN_FILE)) {
    const fs = require('fs');
    fs.unlinkSync(TOKEN_FILE);
  }
}

export interface AppConfig {
  name: string;
  version: string;
  description: string;
  entities: EntityConfig[];
  auth: AuthConfig;
  database: {
    url: string;
  };
  billing: {
    freeLimit: number;
    entityName: string;
  };
}

export class UniversalMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private databaseManager: DatabaseManager;
  private toolFactory: ToolFactory;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.authManager = new AuthManager(config.auth);
    this.databaseManager = new DatabaseManager(config.database.url);
    this.toolFactory = new ToolFactory(this.authManager, this.databaseManager);
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolFactory.generateTools(this.config.entities);
      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Handle authentication tools
        if (name === 'login') {
          return {
            content: [
              {
                type: 'text',
                text: \`Please visit: \${this.config.auth.issuerUrl}/oauth2/auth?client_id=\${this.config.auth.clientId}&redirect_uri=\${this.config.auth.redirectUrl}&response_type=code&scope=openid profile email offline&state=login\`
              }
            ]
          };
        }

        if (name === 'save_token') {
          saveToken(args.token);
          return {
            content: [
              {
                type: 'text',
                text: 'Token saved successfully!'
              }
            ]
          };
        }

        if (name === 'logout') {
          clearToken();
          return {
            content: [
              {
                type: 'text',
                text: 'Logged out successfully!'
              }
            ]
          };
        }

        if (name === 'refresh_billing_status') {
          const token = getStoredToken();
          if (!token) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ No authentication token found. Please login first.'
                }
              ]
            };
          }

          // Decode and validate JWT token
          let decoded;
          try {
            decoded = jwt.decode(token) as any;
            if (!decoded || !decoded.sub) {
              return {
                content: [
                  {
                    type: 'text',
                    text: '❌ Invalid token format. Please login again.'
                  }
                ]
              };
            }
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ Error decoding token. Please login again.'
                }
              ]
            };
          }

          const billingStatus = await this.authManager.getBillingStatus(decoded.sub, token);
          
          return {
            content: [
              {
                type: 'text',
                text: \`📊 Billing Status:\\nPlan: \${billingStatus.plan}\\nFeatures: \${JSON.stringify(billingStatus.features)}\\nCan Create: \${billingStatus.canCreate}\\nReason: \${billingStatus.reason || 'N/A'}\`
              }
            ]
          };
        }

        // Handle CRUD operations
        const token = getStoredToken();
        if (!token) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ No authentication token found. Please login first.'
              }
            ]
          };
        }

        // Decode and validate JWT token
        let decoded;
        try {
          decoded = jwt.decode(token) as any;
          if (!decoded || !decoded.sub) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ Invalid token format. Please login again.'
                }
              ]
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Error decoding token. Please login again.'
              }
            ]
          };
        }

        const userId = decoded.sub;

        // Check billing status for create operations
        if (name.startsWith('create_')) {
          const billingStatus = await this.authManager.getBillingStatus(userId, token);
          if (!billingStatus.canCreate) {
            return {
              content: [
                {
                  type: 'text',
                  text: \`❌ \${billingStatus.reason}\\n\\nPlease upgrade your plan at: \${this.config.auth.issuerUrl}/portal\`
                }
              ]
            };
          }
        }

        // Execute CRUD operation
        const result = await this.toolFactory.executeTool(name, args, userId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: \`❌ Error: \${error instanceof Error ? error.message : 'Unknown error'}\`
            }
          ]
        };
      }
    });
  }

  async initializeDatabase(): Promise<void> {
    await this.databaseManager.setupDatabase(this.config.entities);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log(\`🚀 \${this.config.name} MCP server starting...\`);
    console.log(\`📋 Available entities: \${this.config.entities.map(e => e.name).join(', ')}\`);
    console.log(\`🔧 Available tools: \${this.toolFactory.generateTools(this.config.entities).map(t => t.name).join(', ')}\`);
    console.log(\`\${this.config.name} MCP server running on stdio\`);
  }
}

export function createMCPServer(config: AppConfig): UniversalMCPServer {
  return new UniversalMCPServer(config);
}
`;

    const serverDir = join(this.projectPath, 'src/core/server');
    mkdirSync(serverDir, { recursive: true });
    writeFileSync(join(serverDir, 'index.ts'), serverContent);
  }

  private async generateToolsModule(): Promise<void> {
    const toolsContent = `/**
 * Universal MCP Tool Factory
 * Generates MCP tools dynamically based on entity configurations
 */

import { AuthManager } from '../auth/index.js';
import { DatabaseManager, EntityConfig } from '../database/index.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

export class ToolFactory {
  constructor(
    private authManager: AuthManager,
    private databaseManager: DatabaseManager
  ) {}

  generateTools(entities: EntityConfig[]): ToolDefinition[] {
    const tools: ToolDefinition[] = [
      {
        name: 'login',
        description: 'Get authentication URL for login',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'save_token',
        description: 'Save authentication token for the current session',
        inputSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token from Kinde authentication'
            }
          },
          required: ['token'],
          additionalProperties: false
        }
      },
      {
        name: 'logout',
        description: 'Log out the current user',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'refresh_billing_status',
        description: 'Check current billing status and usage',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    ];

    // Generate CRUD tools for each entity
    for (const entity of entities) {
      tools.push(...this.generateEntityTools(entity));
    }

    return tools;
  }

  private generateEntityTools(entity: EntityConfig): ToolDefinition[] {
    const entityName = entity.name;
    const capitalizedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);

    return [
      {
        name: \`create_\${entityName}\`,
        description: \`Create a new \${entityName}\`,
        inputSchema: {
          type: 'object',
          properties: this.generateFieldSchema(entity.fields),
          required: entity.fields.filter(f => f.required).map(f => f.name),
          additionalProperties: false
        }
      },
      {
        name: \`list_\${entityName}\`,
        description: \`List all \${entityName}s for the current user\`,
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              default: 50,
              description: 'Maximum number of items to return'
            },
            offset: {
              type: 'number',
              default: 0,
              description: 'Number of items to skip'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: \`get_\${entityName}\`,
        description: \`Get a specific \${entityName} by ID\`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'ID of the item to retrieve'
            }
          },
          required: ['id'],
          additionalProperties: false
        }
      },
      {
        name: \`update_\${entityName}\`,
        description: \`Update an existing \${entityName}\`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'ID of the item to update'
            },
            ...this.generateFieldSchema(entity.fields)
          },
          required: ['id'],
          additionalProperties: false
        }
      },
      {
        name: \`delete_\${entityName}\`,
        description: \`Delete a \${entityName}\`,
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'ID of the item to delete'
            }
          },
          required: ['id'],
          additionalProperties: false
        }
      }
    ];
  }

  private generateFieldSchema(fields: any[]): any {
    const schema: any = {};
    for (const field of fields) {
      schema[field.name] = {
        type: this.getJsonSchemaType(field.type),
        description: \`\${field.name} field\`
      };
      if (field.defaultValue !== undefined) {
        schema[field.name].default = field.defaultValue;
      }
    }
    return schema;
  }

  private getJsonSchemaType(type: string): string {
    switch (type) {
      case 'string':
      case 'text':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'timestamp':
        return 'string';
      default:
        return 'string';
    }
  }

  async executeTool(toolName: string, args: any, userId: string): Promise<any> {
    if (toolName.startsWith('create_')) {
      const entityName = toolName.replace('create_', '');
      return await this.databaseManager.create(entityName, args, userId);
    }
    
    if (toolName.startsWith('list_')) {
      const entityName = toolName.replace('list_', '');
      return await this.databaseManager.list(entityName, userId, args.limit || 50, args.offset || 0);
    }
    
    if (toolName.startsWith('get_')) {
      const entityName = toolName.replace('get_', '');
      return await this.databaseManager.get(entityName, args.id, userId);
    }
    
    if (toolName.startsWith('update_')) {
      const entityName = toolName.replace('update_', '');
      const { id, ...updateData } = args;
      return await this.databaseManager.update(entityName, id, updateData, userId);
    }
    
    if (toolName.startsWith('delete_')) {
      const entityName = toolName.replace('delete_', '');
      return await this.databaseManager.delete(entityName, args.id, userId);
    }
    
    throw new Error(\`Unknown tool: \${toolName}\`);
  }
}
`;

    const toolsDir = join(this.projectPath, 'src/core/tools');
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(join(toolsDir, 'index.ts'), toolsContent);
  }

  private async generateKindeAuthServer(): Promise<void> {
    const kindeAuthContent = `/**
 * Kinde Authentication Server
 * Express server for handling Kinde OAuth flow
 */

import express from 'express';
import session from 'express-session';
import { createKindeServerClient, GrantType, SessionManager } from '@kinde-oss/kinde-typescript-sdk';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const app = express();
const PORT = 3000;

// Database connection
const sql = neon(process.env.DATABASE_URL!);

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    idToken?: string;
    userInfo?: any;
    userName?: string;
    userEmail?: string;
  }
}

// Add session middleware
app.use(session({
  secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true, // More secure
    sameSite: 'lax' // Better for localhost
  }
}));

// Session manager factory
const createSessionManager = (req: any): SessionManager => ({
  getSessionItem: async (key: string) => req.session?.[key],
  setSessionItem: async (key: string, value: any) => {
    if (!req.session) req.session = {};
    req.session[key] = value;
  },
  removeSessionItem: async (key: string) => {
    if (req.session) delete req.session[key];
  },
  destroySession: async () => {
    req.session = {};
  }
});

// Create Kinde client
const kindeClient = createKindeServerClient(GrantType.AUTHORIZATION_CODE, {
  authDomain: process.env.KINDE_ISSUER_URL!,
  clientId: process.env.KINDE_CLIENT_ID!,
  clientSecret: process.env.KINDE_CLIENT_SECRET!,
  redirectURL: 'http://localhost:3000/callback',
  logoutRedirectURL: 'http://localhost:3000',
});

// Home page with login button
app.get('/', (req, res) => {
  const token = req.session?.accessToken;
  const userInfo = req.session?.userInfo;
  
  if (token) {
    // Use stored user info from session
    const userEmail = req.session?.userEmail || 'user@example.com';
    const userName = req.session?.userName || 'User';
    console.log('👤 Displaying user:', { userName, userEmail });
    
    res.send(\`
      <html>
        <head>
          <title>Kinde Auth Test</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 600px; margin: 0 auto; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .token-box { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .btn { display: inline-block; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px; }
            .btn-primary { background: #007bff; color: white; }
            .btn-success { background: #28a745; color: white; }
            .btn-danger { background: #dc3545; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Already Authenticated!</h1>
            <div class="success">
              <strong>Welcome back, \${userName}!</strong><br>
              Email: \${userEmail}<br>
              Session persists across page refreshes.
            </div>
            
            <h2>🔑 Your Access Token:</h2>
            <div class="token-box">
              <textarea id="accessToken" style="width: 100%; height: 100px; font-family: monospace; border: none; background: transparent;" readonly>\${token}</textarea>
              <button onclick="copyAccessToken()" style="margin-top: 10px; padding: 5px 10px;">Copy Access Token</button>
            </div>
            
            <h2>🆔 Your ID Token (Use this with MCP server):</h2>
            <div class="token-box">
              <textarea id="idToken" style="width: 100%; height: 100px; font-family: monospace; border: none; background: transparent;" readonly>\${req.session.idToken || 'No ID token available'}</textarea>
              <button onclick="copyIdToken()" style="margin-top: 10px; padding: 5px 10px;">Copy ID Token</button>
            </div>
            
            <h2>💳 Billing Management:</h2>
            <p><a href="https://learnflowai.kinde.com/portal" target="_blank" class="btn btn-success">🔗 Manage Billing</a></p>
            
            <p>
              <a href="/logout" class="btn btn-danger">Logout</a>
              <a href="/" class="btn btn-primary">Refresh Page</a>
            </p>
          </div>
          
          <script>
            function copyAccessToken() {
              document.getElementById('accessToken').select();
              document.execCommand('copy');
              alert('Access Token copied to clipboard!');
            }
            
            function copyIdToken() {
              document.getElementById('idToken').select();
              document.execCommand('copy');
              alert('ID Token copied to clipboard! Use this with the MCP server.');
            }
          </script>
        </body>
      </html>
    \`);
  } else {
    res.send(\`
      <html>
        <head>
          <title>Kinde Auth Test</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 600px; margin: 0 auto; }
            .btn { display: inline-block; padding: 10px 20px; text-decoration: none; border-radius: 5px; background: #007bff; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Kinde Authentication Test</h1>
            <p>Click the button below to login with Kinde:</p>
            <a href="/login" class="btn">Login with Kinde</a>
          </div>
        </body>
      </html>
    \`);
  }
});


// Login route
app.get('/login', async (req, res) => {
  try {
    const sessionManager = createSessionManager(req);
    const loginUrl = await kindeClient.login(sessionManager);
    res.redirect(loginUrl.toString());
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Login failed');
  }
});

// Callback route
app.get('/callback', async (req, res) => {
  try {
    const sessionManager = createSessionManager(req);
    const fullUrl = \`http://\${req.headers.host}\${req.url}\`;
    console.log('Callback URL:', fullUrl);
    
    // Extract the authorization code from the URL
    const url = new URL(fullUrl);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return res.status(400).send('No authorization code received');
    }
    
    // Manually exchange the code for tokens
    const tokenResponse = await fetch(\`\${process.env.KINDE_ISSUER_URL}/oauth2/token\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KINDE_CLIENT_ID!,
        client_secret: process.env.KINDE_CLIENT_SECRET!,
        code: code,
        redirect_uri: 'http://localhost:3000/callback',
      }),
    });
    
    const tokenData = await tokenResponse.json();
    console.log('Token response:', tokenData);
    
    if (tokenData.access_token) {
      // Store tokens in session for persistence
      req.session.accessToken = tokenData.access_token;
      req.session.idToken = tokenData.id_token;
      req.session.userInfo = tokenData;
      
      // Decode the ID token to get user info
      const idToken = tokenData.id_token;
      const user = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
      console.log('👤 User info from ID token:', user);
      
      // Store user info in session for easy access
      req.session.userName = user.given_name || user.name || 'User';
      req.session.userEmail = user.email || 'user@example.com';
      
      // Automatically create user in database
      try {
        const userId = user.sub;
        const userName = user.given_name || user.name || 'User';
        const userEmail = user.email || 'user@example.com';
        
        // Check if user already exists
        const existingUser = await sql\`
          SELECT * FROM users WHERE user_id = \${userId}
        \`;
        
        if (existingUser.length === 0) {
          // Create new user
          await sql\`
            INSERT INTO users (user_id, name, email, subscription_status, plan, free_todos_used)
            VALUES (\${userId}, \${userName}, \${userEmail}, 'free', 'free', 0)
          \`;
          console.log('✅ User automatically created in database:', userName, userEmail);
        } else {
          // Update existing user info
          await sql\`
            UPDATE users 
            SET name = \${userName}, email = \${userEmail}
            WHERE user_id = \${userId}
          \`;
          console.log('✅ User info updated in database:', userName, userEmail);
        }
      } catch (error) {
        console.log('⚠️ Could not auto-create user in database:', error);
      }
      
      // Redirect to home page after successful authentication
      res.redirect('/');
    } else {
      console.log('No access token received');
      res.status(400).send('Authentication failed - no access token received');
    }
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send(\`Authentication failed: \${error instanceof Error ? error.message : 'Unknown error'}\`);
  }
});

// Logout route
app.get('/logout', async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log('Session destroy error:', err);
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send('Logout failed');
  }
});

app.listen(PORT, () => {
  console.log(\`🚀 Kinde Auth Server running at http://localhost:\${PORT}\`);
  console.log('📋 Open your browser and go to http://localhost:3000');
  console.log('🔐 Login with your Kinde account to get a real JWT token');
});
`;

    writeFileSync(join(this.projectPath, 'src/kinde-auth-server.ts'), kindeAuthContent);
  }

  private async generateAppFiles(template: string, appTemplate: AppTemplate): Promise<void> {
    // Generate app-specific config
    const appConfigContent = this.generateAppConfig(template, appTemplate);
    writeFileSync(join(this.projectPath, 'src/app-config.ts'), appConfigContent);
    
    // Update universal-server.ts to use the app config
    await this.updateUniversalServer();
  }

  private async generateSetupScript(): Promise<void> {
    const setupContent = `/**
 * Database Setup Script
 * Initializes database schema for your MCP application
 */

import { createMCPServer } from './core/server';
import { appConfig } from './app-config';

async function setupDatabase() {
  console.log('🚀 Setting up database for your application...');

  try {
    const server = createMCPServer(appConfig);
    await server.initializeDatabase();
    console.log('✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
`;

    writeFileSync(join(this.projectPath, 'src/setup-db.ts'), setupContent);
  }

  private async updateUniversalServer(): Promise<void> {
    const universalServerContent = `/**
 * Universal MCP Server Entry Point
 * This is the main file for your MCP application
 */

import dotenv from 'dotenv';
import { createMCPServer } from './core/server';
import { appConfig } from './app-config';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting ${this.appName} MCP server...');

  // Create and initialize the MCP server
  const server = createMCPServer(appConfig);
  
  try {
    // Initialize database schema
    await server.initializeDatabase();
    
    // Start the server
    await server.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
`;

    writeFileSync(join(this.projectPath, 'src/universal-server.ts'), universalServerContent);
  }

  private generateAppConfig(template: string, appTemplate: AppTemplate): string {
    const entityConfigs = appTemplate.entities.map(entity => {
      return `const ${entity}Entity: EntityConfig = {
  name: '${entity}s',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'text' },
    { name: 'created_at', type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_${entity}s_created_at ON ${entity}s(created_at)'
  ]
};`;
    }).join('\n\n');

    return `import dotenv from 'dotenv';
import { AppConfig } from './core/server';
import { EntityConfig } from './core/database';

// Load environment variables first
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'KINDE_ISSUER_URL', 
  'KINDE_CLIENT_ID',
  'KINDE_CLIENT_SECRET',
  'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(\`Missing required environment variable: \${envVar}\`);
  }
}

${entityConfigs}

export const appConfig: AppConfig = {
  name: '${this.appName}-mcp-server',
  version: '1.0.0',
  description: '${appTemplate.description}',
  entities: [${appTemplate.entities.map(e => `${e}Entity`).join(', ')}],
  auth: {
    issuerUrl: process.env.KINDE_ISSUER_URL!,
    clientId: process.env.KINDE_CLIENT_ID!,
    clientSecret: process.env.KINDE_CLIENT_SECRET!,
    redirectUrl: 'http://localhost:3000/callback',
    logoutRedirectUrl: 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET!
  },
  database: {
    url: process.env.DATABASE_URL!
  },
  billing: {
    freeLimit: 10,
    entityName: '${appTemplate.entities[0]}s'
  }
};
`;
  }

  private generateToolsList(entities: string[]): string {
    const tools = entities.flatMap(entity => [
      `- create_${entity}`,
      `- list_${entity}`,
      `- get_${entity}`,
      `- update_${entity}`,
      `- delete_${entity}`
    ]);

    return tools.join('\n');
  }
}

// CLI interface
export async function createApp(appName: string, template: string, outputDir: string) {
  const generator = new AppGenerator(outputDir, appName);
  await generator.generateApp(template);
}