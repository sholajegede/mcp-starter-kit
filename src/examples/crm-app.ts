/**
 * Example: CRM Application Configuration
 * Demonstrates how to create a CRM system with contacts, deals, and tasks
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

// Define the CRM entities
const contactsEntity: EntityConfig = {
  name: 'contacts',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'email', type: 'string', required: true },
    { name: 'phone', type: 'string' },
    { name: 'company', type: 'string' },
    { name: 'position', type: 'string' },
    { name: 'status', type: 'string', defaultValue: 'lead' },
    { name: 'notes', type: 'text' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)'
  ]
};

const dealsEntity: EntityConfig = {
  name: 'deals',
  fields: [
    { name: 'contact_id', type: 'number', required: true },
    { name: 'title', type: 'string', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'stage', type: 'string', required: true },
    { name: 'probability', type: 'number', defaultValue: 0 },
    { name: 'close_date', type: 'timestamp' },
    { name: 'notes', type: 'text' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id)',
    'CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)',
    'CREATE INDEX IF NOT EXISTS idx_deals_amount ON deals(amount)'
  ]
};

const tasksEntity: EntityConfig = {
  name: 'tasks',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'text' },
    { name: 'contact_id', type: 'number' },
    { name: 'deal_id', type: 'number' },
    { name: 'due_date', type: 'timestamp' },
    { name: 'status', type: 'string', defaultValue: 'pending' },
    { name: 'priority', type: 'string', defaultValue: 'medium' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)'
  ]
};

// CRM app configuration
export const crmAppConfig: AppConfig = {
  name: 'crm-mcp-server',
  version: '1.0.0',
  description: 'Customer Relationship Management system with contacts, deals, and tasks',
  entities: [contactsEntity, dealsEntity, tasksEntity],
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
    freeLimit: 20,
    entityName: 'contacts'
  }
};

// Available tools for this app:
// - create_contact(name, email, phone, company, position, status, notes)
// - list_contacts(limit, offset)
// - get_contact(id)
// - update_contact(id, name, email, phone, company, position, status, notes)
// - delete_contact(id)
// - create_deal(contact_id, title, amount, stage, probability, close_date, notes)
// - list_deals(limit, offset)
// - get_deal(id)
// - update_deal(id, contact_id, title, amount, stage, probability, close_date, notes)
// - delete_deal(id)
// - create_task(title, description, contact_id, deal_id, due_date, status, priority)
// - list_tasks(limit, offset)
// - get_task(id)
// - update_task(id, title, description, contact_id, deal_id, due_date, status, priority)
// - delete_task(id)
// - login, save_token, logout, refresh_billing_status
