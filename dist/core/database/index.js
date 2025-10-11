/**
 * Universal Database Module
 * Handles dynamic schema generation and CRUD operations
 */
import { neon } from '@neondatabase/serverless';
export class DatabaseManager {
    sql;
    entities = new Map();
    constructor(databaseUrl) {
        this.sql = neon(databaseUrl);
    }
    /**
     * Register an entity configuration
     */
    registerEntity(config) {
        this.entities.set(config.name, config);
    }
    /**
     * Generate SQL schema for an entity
     */
    generateSchema(entityName) {
        const entity = this.entities.get(entityName);
        if (!entity) {
            throw new Error(`Entity ${entityName} not found`);
        }
        const fields = entity.fields.map(field => {
            let sqlType = this.getSQLType(field.type);
            if (field.required)
                sqlType += ' NOT NULL';
            if (field.unique)
                sqlType += ' UNIQUE';
            if (field.defaultValue !== undefined) {
                sqlType += ` DEFAULT ${this.formatDefaultValue(field.defaultValue, field.type)}`;
            }
            return `${field.name} ${sqlType}`;
        }).join(',\n    ');
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
        return `CREATE TABLE IF NOT EXISTS ${entityName} (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  ${fields}${additionalFields}
)`;
    }
    /**
     * Generate indexes for an entity
     */
    generateIndexes(entityName) {
        const entity = this.entities.get(entityName);
        if (!entity)
            return [];
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_${entityName}_user_id ON ${entityName}(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_${entityName}_created_at ON ${entityName}(created_at)`
        ];
        // Add custom indexes
        if (entity.indexes) {
            indexes.push(...entity.indexes);
        }
        return indexes;
    }
    /**
     * Create an entity in the database
     */
    async createEntity(entityName, data, userId) {
        try {
            const entity = this.entities.get(entityName);
            if (!entity) {
                return { success: false, error: `Entity ${entityName} not found` };
            }
            // Add user_id to data
            const insertData = { ...data, user_id: userId };
            // Build dynamic insert query using parameterized query
            const columns = Object.keys(insertData);
            const values = Object.values(insertData);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const columnsStr = columns.join(', ');
            const sql = `INSERT INTO ${entityName} (${columnsStr}) VALUES (${placeholders}) RETURNING id`;
            const result = await this.sql(sql, values);
            return {
                success: true,
                data: result[0],
                id: result[0].id
            };
        }
        catch (error) {
            console.error(`Failed to create ${entityName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * List entities for a user
     */
    async listEntities(entityName, userId, limit = 50, offset = 0) {
        try {
            const sql = `SELECT * FROM ${entityName} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
            const result = await this.sql(sql, [userId, limit, offset]);
            return {
                success: true,
                data: result
            };
        }
        catch (error) {
            console.error(`Failed to list ${entityName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Update an entity
     */
    async updateEntity(entityName, id, data, userId) {
        try {
            // First check if entity belongs to user
            const sql = `SELECT * FROM ${entityName} WHERE id = $1 AND user_id = $2`;
            const existing = await this.sql(sql, [id, userId]);
            if (existing.length === 0) {
                return {
                    success: false,
                    error: 'Entity not found or access denied'
                };
            }
            // Update the entity
            const setClause = Object.keys(data).map((key, index) => `${key} = $${index + 3}`).join(', ');
            const values = Object.values(data);
            const updateSql = `UPDATE ${entityName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *`;
            const result = await this.sql(updateSql, [id, userId, ...values]);
            return {
                success: true,
                data: result[0]
            };
        }
        catch (error) {
            console.error(`Failed to update ${entityName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Delete an entity
     */
    async deleteEntity(entityName, id, userId) {
        try {
            const sql = `DELETE FROM ${entityName} WHERE id = $1 AND user_id = $2 RETURNING id`;
            const result = await this.sql(sql, [id, userId]);
            if (result.length === 0) {
                return {
                    success: false,
                    error: 'Entity not found or access denied'
                };
            }
            return {
                success: true,
                data: { id: result[0].id }
            };
        }
        catch (error) {
            console.error(`Failed to delete ${entityName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get entity by ID
     */
    async getEntity(entityName, id, userId) {
        try {
            const sql = `SELECT * FROM ${entityName} WHERE id = $1 AND user_id = $2`;
            const result = await this.sql(sql, [id, userId]);
            if (result.length === 0) {
                return {
                    success: false,
                    error: 'Entity not found or access denied'
                };
            }
            return {
                success: true,
                data: result[0]
            };
        }
        catch (error) {
            console.error(`Failed to get ${entityName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Setup database schema for all registered entities
     */
    async setupDatabase() {
        try {
            // Create users table first (required for auth)
            const createUsersTableSQL = `
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
      `;
            await this.sql(createUsersTableSQL);
            // Create indexes for users
            await this.sql(`CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)`);
            // Create tables for all registered entities
            for (const [entityName, entity] of this.entities) {
                const schema = this.generateSchema(entityName);
                await this.sql(schema);
                // Create indexes
                const indexes = this.generateIndexes(entityName);
                for (const index of indexes) {
                    await this.sql(index);
                }
            }
            console.log('✅ Database schema created successfully!');
        }
        catch (error) {
            console.error('❌ Failed to setup database:', error);
            throw error;
        }
    }
    getSQLType(type) {
        switch (type) {
            case 'string': return 'TEXT';
            case 'number': return 'INTEGER';
            case 'boolean': return 'BOOLEAN';
            case 'text': return 'TEXT';
            case 'timestamp': return 'TIMESTAMP';
            default: return 'TEXT';
        }
    }
    formatDefaultValue(value, type) {
        if (type === 'string' || type === 'text') {
            return `'${value}'`;
        }
        if (type === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        }
        return value.toString();
    }
}
//# sourceMappingURL=index.js.map