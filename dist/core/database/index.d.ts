/**
 * Universal Database Module
 * Handles dynamic schema generation and CRUD operations
 */
export interface FieldDefinition {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'text' | 'timestamp';
    required?: boolean;
    unique?: boolean;
    defaultValue?: any;
}
export interface EntityConfig {
    name: string;
    fields: FieldDefinition[];
    indexes?: string[];
    permissions?: {
        create: string[];
        read: string[];
        update: string[];
        delete: string[];
    };
}
export interface CRUDResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    id?: number;
}
export declare class DatabaseManager {
    private sql;
    private entities;
    constructor(databaseUrl: string);
    /**
     * Register an entity configuration
     */
    registerEntity(config: EntityConfig): void;
    /**
     * Generate SQL schema for an entity
     */
    generateSchema(entityName: string): string;
    /**
     * Generate indexes for an entity
     */
    generateIndexes(entityName: string): string[];
    /**
     * Create an entity in the database
     */
    createEntity(entityName: string, data: any, userId: string): Promise<CRUDResult>;
    /**
     * List entities for a user
     */
    listEntities(entityName: string, userId: string, limit?: number, offset?: number): Promise<CRUDResult>;
    /**
     * Update an entity
     */
    updateEntity(entityName: string, id: number, data: any, userId: string): Promise<CRUDResult>;
    /**
     * Delete an entity
     */
    deleteEntity(entityName: string, id: number, userId: string): Promise<CRUDResult>;
    /**
     * Get entity by ID
     */
    getEntity(entityName: string, id: number, userId: string): Promise<CRUDResult>;
    /**
     * Setup database schema for all registered entities
     */
    setupDatabase(): Promise<void>;
    private getSQLType;
    private formatDefaultValue;
}
//# sourceMappingURL=index.d.ts.map