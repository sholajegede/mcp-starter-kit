/**
 * Universal MCP Tool Factory
 * Generates MCP tools dynamically based on entity configurations
 */
import { AuthManager } from '../auth/index.js';
import { DatabaseManager, EntityConfig } from '../database/index.js';
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any, userId: string) => Promise<any>;
}
export declare class ToolFactory {
    private authManager;
    private dbManager;
    constructor(authManager: AuthManager, dbManager: DatabaseManager);
    /**
     * Generate CRUD tools for an entity
     */
    generateCRUDTools(entityConfig: EntityConfig): ToolDefinition[];
    /**
     * Generate authentication tools
     */
    generateAuthTools(): ToolDefinition[];
    /**
     * Generate input schema for entity operations
     */
    private generateInputSchema;
    /**
     * Convert database type to JSON Schema type
     */
    private getJSONSchemaType;
}
//# sourceMappingURL=index.d.ts.map