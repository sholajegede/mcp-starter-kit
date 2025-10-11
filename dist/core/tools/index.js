/**
 * Universal MCP Tool Factory
 * Generates MCP tools dynamically based on entity configurations
 */
export class ToolFactory {
    authManager;
    dbManager;
    constructor(authManager, dbManager) {
        this.authManager = authManager;
        this.dbManager = dbManager;
    }
    /**
     * Generate CRUD tools for an entity
     */
    generateCRUDTools(entityConfig) {
        const tools = [];
        // Create tool
        tools.push({
            name: `create_${entityConfig.name}`,
            description: `Create a new ${entityConfig.name}`,
            inputSchema: this.generateInputSchema(entityConfig, 'create'),
            handler: async (args, userId) => {
                // Check billing status
                const billing = await this.authManager.getUserBillingStatus(userId);
                if (!billing.canCreate) {
                    return {
                        success: false,
                        error: billing.reason,
                        upgradeUrl: billing.upgradeUrl
                    };
                }
                const result = await this.dbManager.createEntity(entityConfig.name, args, userId);
                if (result.success) {
                    // Increment usage counter
                    await this.authManager.incrementUsage(userId);
                }
                return result;
            }
        });
        // List tool
        tools.push({
            name: `list_${entityConfig.name}s`,
            description: `List all ${entityConfig.name}s for the current user`,
            inputSchema: {
                type: 'object',
                properties: {
                    limit: { type: 'number', default: 50, description: 'Maximum number of items to return' },
                    offset: { type: 'number', default: 0, description: 'Number of items to skip' }
                },
                additionalProperties: false
            },
            handler: async (args, userId) => {
                return await this.dbManager.listEntities(entityConfig.name, userId, args.limit || 50, args.offset || 0);
            }
        });
        // Get tool
        tools.push({
            name: `get_${entityConfig.name}`,
            description: `Get a specific ${entityConfig.name} by ID`,
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'ID of the item to retrieve' }
                },
                required: ['id'],
                additionalProperties: false
            },
            handler: async (args, userId) => {
                return await this.dbManager.getEntity(entityConfig.name, args.id, userId);
            }
        });
        // Update tool
        tools.push({
            name: `update_${entityConfig.name}`,
            description: `Update an existing ${entityConfig.name}`,
            inputSchema: this.generateInputSchema(entityConfig, 'update'),
            handler: async (args, userId) => {
                const { id, ...updateData } = args;
                return await this.dbManager.updateEntity(entityConfig.name, id, updateData, userId);
            }
        });
        // Delete tool
        tools.push({
            name: `delete_${entityConfig.name}`,
            description: `Delete a ${entityConfig.name}`,
            inputSchema: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'ID of the item to delete' }
                },
                required: ['id'],
                additionalProperties: false
            },
            handler: async (args, userId) => {
                return await this.dbManager.deleteEntity(entityConfig.name, args.id, userId);
            }
        });
        return tools;
    }
    /**
     * Generate authentication tools
     */
    generateAuthTools() {
        return [
            {
                name: 'login',
                description: 'Get authentication URL for login',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false
                },
                handler: async () => {
                    return {
                        success: true,
                        message: 'Please visit http://localhost:3000 to login with Kinde',
                        loginUrl: 'http://localhost:3000'
                    };
                }
            },
            {
                name: 'save_token',
                description: 'Save authentication token for the current session',
                inputSchema: {
                    type: 'object',
                    properties: {
                        token: { type: 'string', description: 'JWT token from Kinde authentication' }
                    },
                    required: ['token'],
                    additionalProperties: false
                },
                handler: async (args) => {
                    // Verify token and create/update user
                    const user = await this.authManager.verifyToken(args.token);
                    if (!user) {
                        return {
                            success: false,
                            error: 'Invalid token'
                        };
                    }
                    await this.authManager.createOrUpdateUser({
                        id: user.id,
                        email: user.email,
                        name: user.name
                    });
                    return {
                        success: true,
                        message: 'Token saved successfully! You can now use commands like "list todos" and "create todo"',
                        user: {
                            name: user.name,
                            email: user.email
                        }
                    };
                }
            },
            {
                name: 'logout',
                description: 'Log out the current user',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false
                },
                handler: async () => {
                    return {
                        success: true,
                        message: 'Logged out successfully. Visit http://localhost:3000/logout to complete logout.'
                    };
                }
            },
            {
                name: 'refresh_billing_status',
                description: 'Check current billing status and usage',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false
                },
                handler: async (args, userId) => {
                    const billing = await this.authManager.getUserBillingStatus(userId);
                    return {
                        success: true,
                        message: 'Billing status refreshed successfully!',
                        kindeBilling: billing
                    };
                }
            }
        ];
    }
    /**
     * Generate input schema for entity operations
     */
    generateInputSchema(entityConfig, operation) {
        const properties = {};
        const required = [];
        // Add ID field for update operations
        if (operation === 'update') {
            properties.id = {
                type: 'number',
                description: 'ID of the item to update'
            };
            required.push('id');
        }
        // Add entity fields
        for (const field of entityConfig.fields) {
            const fieldSchema = {
                type: this.getJSONSchemaType(field.type),
                description: `${field.name} field`
            };
            if (field.defaultValue !== undefined) {
                fieldSchema.default = field.defaultValue;
            }
            properties[field.name] = fieldSchema;
            if (field.required && operation === 'create') {
                required.push(field.name);
            }
        }
        return {
            type: 'object',
            properties,
            required,
            additionalProperties: false
        };
    }
    /**
     * Convert database type to JSON Schema type
     */
    getJSONSchemaType(dbType) {
        switch (dbType) {
            case 'string':
            case 'text':
                return 'string';
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'timestamp':
                return 'string'; // JSON Schema doesn't have timestamp type
            default:
                return 'string';
        }
    }
}
//# sourceMappingURL=index.js.map