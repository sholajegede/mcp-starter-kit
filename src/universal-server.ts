/**
 * Universal MCP Server Entry Point
 * This is the main file that can be configured for any application
 */

import dotenv from 'dotenv';
import { createMCPServer } from './core/server/index.js';
import { blogAppConfig } from './examples/blog-app.js';
import { ecommerceAppConfig } from './examples/ecommerce-app.js';
import { crmAppConfig } from './examples/crm-app.js';
import { todoAppConfig } from './examples/todo-app.js';

// Load environment variables
dotenv.config();

// Configuration mapping - add your app configs here
const APP_CONFIGS = {
  'blog': blogAppConfig,
  'ecommerce': ecommerceAppConfig,
  'crm': crmAppConfig,
  'todo': todoAppConfig,
  // Add more app types here
};

// Get app type from environment or default to 'blog'
const APP_TYPE = process.env.APP_TYPE || 'blog';

async function main() {
  console.log(`🚀 Starting ${APP_TYPE} MCP server...`);

  // Get configuration for the selected app type
  const config = APP_CONFIGS[APP_TYPE as keyof typeof APP_CONFIGS];
  
  if (!config) {
    console.error(`❌ Unknown app type: ${APP_TYPE}`);
    console.log(`Available app types: ${Object.keys(APP_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  // Create and initialize the MCP server
  const server = createMCPServer(config);
  
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
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
