/**
 * Example: E-commerce Application Configuration
 * Demonstrates how to create an e-commerce app with products and orders
 */

import dotenv from 'dotenv';
import { AppConfig } from '../core/server';
import { EntityConfig } from '../core/database';

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

// Define the e-commerce entities
const productsEntity: EntityConfig = {
  name: 'products',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'text', required: true },
    { name: 'price', type: 'number', required: true },
    { name: 'category', type: 'string', required: true },
    { name: 'stock', type: 'number', defaultValue: 0 },
    { name: 'active', type: 'boolean', defaultValue: true }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
    'CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)',
    'CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)'
  ]
};

const ordersEntity: EntityConfig = {
  name: 'orders',
  fields: [
    { name: 'customer_name', type: 'string', required: true },
    { name: 'customer_email', type: 'string', required: true },
    { name: 'total_amount', type: 'number', required: true },
    { name: 'status', type: 'string', defaultValue: 'pending' },
    { name: 'shipping_address', type: 'text', required: true },
    { name: 'notes', type: 'text' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email)'
  ]
};

const orderItemsEntity: EntityConfig = {
  name: 'order_items',
  fields: [
    { name: 'order_id', type: 'number', required: true },
    { name: 'product_id', type: 'number', required: true },
    { name: 'quantity', type: 'number', required: true },
    { name: 'price', type: 'number', required: true }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)'
  ]
};

// E-commerce app configuration
export const ecommerceAppConfig: AppConfig = {
  name: 'ecommerce-mcp-server',
  version: '1.0.0',
  description: 'E-commerce management system with products and orders',
  entities: [productsEntity, ordersEntity, orderItemsEntity],
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
    entityName: 'products'
  }
};

// Available tools for this app:
// - create_product(name, description, price, category, stock, active)
// - list_products(limit, offset)
// - get_product(id)
// - update_product(id, name, description, price, category, stock, active)
// - delete_product(id)
// - create_order(customer_name, customer_email, total_amount, status, shipping_address, notes)
// - list_orders(limit, offset)
// - get_order(id)
// - update_order(id, customer_name, customer_email, total_amount, status, shipping_address, notes)
// - delete_order(id)
// - create_order_item(order_id, product_id, quantity, price)
// - list_order_items(limit, offset)
// - get_order_item(id)
// - update_order_item(id, order_id, product_id, quantity, price)
// - delete_order_item(id)
// - login, save_token, logout, refresh_billing_status
