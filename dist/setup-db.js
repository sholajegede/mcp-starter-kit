/**
 * Database Setup Script
 * Initializes database schema for any MCP application
 */
import { createMCPServer } from './core/server/index.js';
import { blogAppConfig } from './examples/blog-app.js';
import { ecommerceAppConfig } from './examples/ecommerce-app.js';
import { crmAppConfig } from './examples/crm-app.js';
import { todoAppConfig } from './examples/todo-app.js';
const APP_CONFIGS = {
    'blog': blogAppConfig,
    'ecommerce': ecommerceAppConfig,
    'crm': crmAppConfig,
    'todo': todoAppConfig,
};
async function setupDatabase() {
    const appType = process.env.APP_TYPE || 'blog';
    console.log(`🚀 Setting up database for ${appType} application...`);
    const config = APP_CONFIGS[appType];
    if (!config) {
        console.error(`❌ Unknown app type: ${appType}`);
        console.log(`Available app types: ${Object.keys(APP_CONFIGS).join(', ')}`);
        process.exit(1);
    }
    try {
        const server = createMCPServer(config);
        await server.initializeDatabase();
        console.log('✅ Database setup completed successfully!');
    }
    catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}
setupDatabase();
//# sourceMappingURL=setup-db.js.map