/**
 * Example: Todo Application Configuration
 * Demonstrates how to create a simple todo management system
 */
import dotenv from 'dotenv';
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
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}
// Define the todo entity
const todosEntity = {
    name: 'todos',
    fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'description', type: 'text' },
        { name: 'completed', type: 'boolean', defaultValue: false },
        { name: 'priority', type: 'string', defaultValue: 'medium' },
        { name: 'due_date', type: 'timestamp' },
        { name: 'tags', type: 'text' } // JSON string for tags array
    ],
    indexes: [
        'CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)',
        'CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)',
        'CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date)'
    ]
};
// Todo app configuration
export const todoAppConfig = {
    name: 'todo-mcp-server',
    version: '1.0.0',
    description: 'Simple todo management system with authentication and billing',
    entities: [todosEntity],
    auth: {
        issuerUrl: process.env.KINDE_ISSUER_URL,
        clientId: process.env.KINDE_CLIENT_ID,
        clientSecret: process.env.KINDE_CLIENT_SECRET,
        redirectUrl: 'http://localhost:3000/callback',
        logoutRedirectUrl: 'http://localhost:3000',
        jwtSecret: process.env.JWT_SECRET
    },
    database: {
        url: process.env.DATABASE_URL
    },
    billing: {
        freeLimit: 5,
        entityName: 'todos'
    }
};
// Available tools for this app:
// - create_todo(title, description, completed, priority, due_date, tags)
// - list_todos(limit, offset)
// - get_todo(id)
// - update_todo(id, title, description, completed, priority, due_date, tags)
// - delete_todo(id)
// - login, save_token, logout, refresh_billing_status
//# sourceMappingURL=todo-app.js.map