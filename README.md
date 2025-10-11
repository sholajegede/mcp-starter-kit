# MCP Starter Kit

**Create MCP applications with authentication, database, and billing in seconds!**

A universal starter kit for building Model Context Protocol (MCP) applications with built-in authentication (Kinde), database (Neon PostgreSQL), and billing systems (Kinde). Perfect for developers who want to start building MCP servers with Cursor.

## Features

- **Built-in Authentication** - Kinde OAuth integration
- **Database Ready** - Neon PostgreSQL with automatic schema setup
- **Billing System** - Freemium model with upgrade flows
- **Multiple Templates** - Blog, E-commerce, CRM, Todo applications
- **One Command Setup** - Interactive CLI for instant project creation
- **Complete Stack** - Authentication server + MCP server + Database
- **Cursor Integration** - Ready to use with Cursor AI

## Perfect For

- **Developers** building MCP servers with Cursor
- **Teams** creating CRUD MCP servers with authentication and billing
- **Anyone** who wants to an easy startkerkit setup

## Quick Start

```bash
# Create a new MCP application (one command!)
npx mcp-starter-kit
```

This will create your project and guide you through the setup process.

> **Note**: Ignore the `npm i mcp-starter-kit` command shown on the npm package page. Use `npx mcp-starter-kit` instead for the best experience.


## Available Templates

| Template | Description | Entities | Perfect For |
|----------|-------------|----------|-------------|
| **blog** | Blog management system | posts, comments | Content creators, writers |
| **ecommerce** | E-commerce platform | products, orders, order_items | Online stores, marketplaces |
| **crm** | Customer relationship management | contacts, deals, tasks | Sales teams, businesses |
| **todo** | Simple todo system | todos | Personal productivity, task management |

## Complete Setup Guide

### **Step 1: Create Your Application**

```bash
npx mcp-starter-kit
```

**What you'll see:**
```
🚀 MCP Starter Kit
Create MCP applications with authentication, database, and billing

📝 What would you like to name your application? my-blog
📋 Choose your template:
  1. blog      - Blog management system (posts, comments)
  2. ecommerce - E-commerce system (products, orders)
  3. crm       - Customer relationship management (contacts, deals, tasks)
  4. todo      - Simple todo management system

🎯 Enter your choice (1-4): 1
🚀 Creating my-blog with blog template...
✅ Application created successfully!
```

### **Step 2: Install Dependencies**

```bash
npm install
```

### **Step 3: Configure Environment**

```bash
# Copy environment template
cp .env.example .env
```

**Configure your `.env` file:**

```env
# Database (Get from Neon)
DATABASE_URL=postgresql://username:password@host:port/database

# Kinde Authentication (Get from Kinde)
KINDE_ISSUER_URL=https://your-domain.kinde.com
KINDE_CLIENT_ID=your_client_id
KINDE_CLIENT_SECRET=your_client_secret

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Server Configuration
NODE_ENV=development
```

### **Step 4: Setup Database**

```bash
# Create database schema
npm run setup-db
```

### **Step 5: Start Authentication Server**

```bash
# In a separate terminal
npm run auth-server
```

Visit `http://localhost:3000` to login and get your authentication token.

### **Step 6: Start MCP Server**

```bash
# In another terminal
npm run dev
```

### **Step 7: Configure Cursor**

Add to your Cursor MCP configuration (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "my-blog": {
      "command": "node",
      "args": ["dist/universal-server.js"],
      "cwd": "/path/to/your/my-blog",
      "env": {
        "DATABASE_URL": "your_database_url",
        "KINDE_ISSUER_URL": "your_kinde_issuer_url",
        "KINDE_CLIENT_ID": "your_kinde_client_id",
        "KINDE_CLIENT_SECRET": "your_kinde_client_secret",
        "JWT_SECRET": "your_jwt_secret"
      }
    }
  }
}
```

## Authentication Flow

1. **Start Auth Server** - `npm run auth-server`
2. **Visit Login Page** - `http://localhost:3000`
3. **Login with Kinde** - Complete OAuth flow
4. **Copy ID Token** - From the auth page
5. **Use in Cursor** - Use `save_token` tool with your token
6. **Start Building** - Use MCP tools in Cursor chat

## Available MCP Tools

After authentication, you'll have access to:

- **Authentication Tools**
  - `login` - Get authentication URL
  - `save_token` - Save your authentication token
  - `logout` - Log out current user
  - `refresh_billing_status` - Check billing status

- **CRUD Tools** (based on your template)
  - `create_[entity]` - Create new items
  - `list_[entity]s` - List all items
  - `get_[entity]` - Get specific item
  - `update_[entity]` - Update existing item
  - `delete_[entity]` - Delete item

## Billing System

- **Free Tier** - Limited items (configurable per template)
- **Upgrade Flow** - Automatic redirect to Kinde billing portal
- **Usage Tracking** - Automatic tracking of free tier usage
- **Plan Management** - Check current plan and usage

## Project Structure

```
my-blog/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Environment template
├── README.md                 # Project documentation
└── src/
    ├── app-config.ts         # Application configuration
    ├── universal-server.ts   # Main MCP server
    ├── setup-db.ts          # Database setup script
    ├── kinde-auth-server.ts  # Authentication server
    └── core/                 # Core MCP modules
        ├── auth/             # Authentication manager
        ├── database/         # Database manager
        ├── server/           # MCP server core
        └── tools/            # Tool factory
```

## Troubleshooting

### **Common Issues**

**MCP Server Not Detected in Cursor:**
- Check `~/.cursor/mcp.json` syntax
- Verify environment variables
- Restart Cursor
- Check server is running

**Authentication Issues:**
- Verify Kinde credentials
- Check redirect URLs in Kinde dashboard
- Ensure auth server is running on port 3000

**Database Connection Issues:**
- Verify Neon database URL
- Check database permissions
- Run `npm run setup-db` to create schema

### **Getting Help**

- Check the generated README in your project
- Verify all environment variables are set
- Ensure both servers are running
- Check Cursor MCP configuration

## Why Choose This?

- **Fast Setup** - From zero to working MCP app in minutes
- **Production Ready** - Real authentication and database
- **Billing Ready** - Built-in freemium model
- **Multiple Templates** - Choose what fits your needs
- **Complete Stack** - Everything you need included
- **Cursor Optimized** - Perfect for AI development

## What's Next?

1. **Create your first app** - `npx mcp-starter-kit`
2. **Choose your template** - Blog, E-commerce, CRM, or Todo
3. **Configure your services** - Neon database + Kinde authentication
4. **Start building** - Use MCP tools in Cursor
5. **Deploy and scale** - Your app is ready for production

## 📄 License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please read our contributing guidelines.

---

**Ready to build your first MCP application? Run `npx mcp-starter-kit` and start building!**
<!-- Last auto-update: Fri Oct 10 18:01:34 PDT 2025 -->
