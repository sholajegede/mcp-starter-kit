/**
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
import jwt from 'jsonwebtoken';

// Token storage functions
const TOKEN_FILE = join(process.cwd(), '.auth-token');

function saveToken(token: string) {
  writeFileSync(TOKEN_FILE, token);
}

function getStoredToken(): string | null {
  if (existsSync(TOKEN_FILE)) {
    return readFileSync(TOKEN_FILE, 'utf8').trim();
  }
  return null;
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
  billing?: {
    freeLimit: number;
    entityName: string;
  };
}

export class UniversalMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private dbManager: DatabaseManager;
  private toolFactory: ToolFactory;
  private config: AppConfig;
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(config: AppConfig) {
    this.config = config;
    
    // Initialize core components
    this.authManager = new AuthManager(config.auth, config.database.url);
    this.dbManager = new DatabaseManager(config.database.url);
    this.toolFactory = new ToolFactory(this.authManager, this.dbManager);

    // Create MCP server
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

    this.setupServer();
  }

  private setupServer() {
    // Register all tools
    this.registerTools();

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolList = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return {
        tools: toolList,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      // Get user ID from stored token
      const token = getStoredToken();
      if (!token) {
        return {
          content: [{
            type: 'text',
            text: '❌ No authentication token found. Please:\n1. Type "login" to get the authentication URL\n2. Complete login at http://localhost:3000\n3. Copy your token and use "save_token" to store it\n4. Then try your command again'
          }]
        };
      }

      const user = await this.authManager.verifyToken(token);
      if (!user) {
        return {
          content: [{
            type: 'text',
            text: '❌ Invalid or expired token. Please login again using "login" command.'
          }]
        };
      }

      try {
        // Validate required parameters for create operations
        if (name.startsWith('create_')) {
          const validationResult = this.validateCreateParameters(name, args);
          if (!validationResult.valid) {
            return {
              content: [{
                type: 'text',
                text: validationResult.message
              }]
            };
          }
        }

        // Validate required parameters for update operations
        if (name.startsWith('update_')) {
          const validationResult = this.validateUpdateParameters(name, args);
          if (!validationResult.valid) {
            return {
              content: [{
                type: 'text',
                text: validationResult.message
              }]
            };
          }
        }

        // Validate required parameters for delete operations
        if (name.startsWith('delete_')) {
          const validationResult = this.validateDeleteParameters(name, args);
          if (!validationResult.valid) {
            return {
              content: [{
                type: 'text',
                text: validationResult.message
              }]
            };
          }
        }

        // Validate required parameters for get operations
        if (name.startsWith('get_')) {
          const validationResult = this.validateGetParameters(name, args);
          if (!validationResult.valid) {
            return {
              content: [{
                type: 'text',
                text: validationResult.message
              }]
            };
          }
        }

        const result = await tool.handler(args, user.id);
        
        if (result.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ ${result.error || 'Operation failed'}`
            }]
          };
        }
      } catch (error) {
        console.error(`Error calling tool ${name}:`, error);
        return {
          content: [{
            type: 'text',
            text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    });
  }

  private registerTools() {
    // Register authentication tools
    const authTools = this.toolFactory.generateAuthTools();
    authTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    // Register CRUD tools for each entity
    this.config.entities.forEach(entity => {
      const crudTools = this.toolFactory.generateCRUDTools(entity);
      crudTools.forEach(tool => {
        this.tools.set(tool.name, tool);
      });
    });
  }

  /**
   * Initialize database schema
   */
  async initializeDatabase(): Promise<void> {
    // Register all entities with database manager
    this.config.entities.forEach(entity => {
      this.dbManager.registerEntity(entity);
    });

    // Setup database schema
    await this.dbManager.setupDatabase();
  }

  /**
   * Validate required parameters for create operations
   */
  private validateCreateParameters(toolName: string, args: any): { valid: boolean; message: string } {
    const entityName = toolName.replace('create_', '');
    const entity = this.config.entities.find(e => e.name === entityName);
    
    if (!entity) {
      return {
        valid: false,
        message: `❌ Entity ${entityName} not found`
      };
    }

    const requiredFields = entity.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(field => !args || args[field.name] === undefined || args[field.name] === null || args[field.name] === '');
    
    if (missingFields.length > 0) {
      const fieldNames = missingFields.map(f => f.name).join(', ');
      const entityDisplayName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
      
      return {
        valid: false,
        message: `📝 **Create ${entityDisplayName}**\n\nPlease provide the following required information:\n\n${missingFields.map(field => `**${field.name}**: ${field.type} (required)`).join('\n')}\n\nPlease provide your answers in this format:\n\`\`\`\n${missingFields.map(f => `${f.name}: your_${f.name}_here`).join('\n')}\`\`\`\n\nExample:\n\`\`\`\n${missingFields.map(f => `${f.name}: example_${f.name}`).join('\n')}\`\`\``
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Validate required parameters for update operations
   */
  private validateUpdateParameters(toolName: string, args: any): { valid: boolean; message: string } {
    const entityName = toolName.replace('update_', '');
    const entity = this.config.entities.find(e => e.name === entityName);
    
    if (!entity) {
      return {
        valid: false,
        message: `❌ Entity ${entityName} not found`
      };
    }

    // Check if ID is provided
    if (!args || !args.id) {
      const entityDisplayName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
      return {
        valid: false,
        message: `📝 **Update ${entityDisplayName}**\n\nPlease provide the ID of the ${entityName} you want to update:\n\n\`\`\`\nid: 1\n\`\`\`\n\nAnd optionally provide the fields you want to update:\n\`\`\`\nid: 1\ntitle: new_title\ndescription: new_description\n\`\`\``
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Validate required parameters for delete operations
   */
  private validateDeleteParameters(toolName: string, args: any): { valid: boolean; message: string } {
    const entityName = toolName.replace('delete_', '');
    const entity = this.config.entities.find(e => e.name === entityName);
    
    if (!entity) {
      return {
        valid: false,
        message: `❌ Entity ${entityName} not found`
      };
    }

    // Check if ID is provided
    if (!args || !args.id) {
      const entityDisplayName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
      return {
        valid: false,
        message: `📝 **Delete ${entityDisplayName}**\n\nPlease provide the ID of the ${entityName} you want to delete:\n\n\`\`\`\nid: 1\n\`\`\``
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Validate required parameters for get operations
   */
  private validateGetParameters(toolName: string, args: any): { valid: boolean; message: string } {
    const entityName = toolName.replace('get_', '');
    const entity = this.config.entities.find(e => e.name === entityName);
    
    if (!entity) {
      return {
        valid: false,
        message: `❌ Entity ${entityName} not found`
      };
    }

    // Check if ID is provided
    if (!args || !args.id) {
      const entityDisplayName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
      return {
        valid: false,
        message: `📝 **Get ${entityDisplayName}**\n\nPlease provide the ID of the ${entityName} you want to retrieve:\n\n\`\`\`\nid: 1\n\`\`\``
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    console.log(`🚀 ${this.config.name} MCP server starting...`);
    console.log(`📋 Available entities: ${this.config.entities.map(e => e.name).join(', ')}`);
    console.log(`🔧 Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log(`${this.config.name} MCP server running on stdio`);
  }
}

/**
 * Create a new MCP server from configuration
 */
export function createMCPServer(config: AppConfig): UniversalMCPServer {
  return new UniversalMCPServer(config);
}
