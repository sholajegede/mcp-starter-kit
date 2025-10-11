/**
 * Universal MCP Server
 * Configurable MCP server that can handle any entity configuration
 */
import { AuthConfig } from '../auth/index.js';
import { EntityConfig } from '../database/index.js';
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
export declare class UniversalMCPServer {
    private server;
    private authManager;
    private dbManager;
    private toolFactory;
    private config;
    private tools;
    constructor(config: AppConfig);
    private setupServer;
    private registerTools;
    /**
     * Initialize database schema
     */
    initializeDatabase(): Promise<void>;
    /**
     * Validate required parameters for create operations
     */
    private validateCreateParameters;
    /**
     * Validate required parameters for update operations
     */
    private validateUpdateParameters;
    /**
     * Validate required parameters for delete operations
     */
    private validateDeleteParameters;
    /**
     * Validate required parameters for get operations
     */
    private validateGetParameters;
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
}
/**
 * Create a new MCP server from configuration
 */
export declare function createMCPServer(config: AppConfig): UniversalMCPServer;
//# sourceMappingURL=index.d.ts.map