# 🚀 NPM Deployment Guide

This guide shows you how to deploy the MCP Starter Kit to NPM as a global CLI tool.

## 📋 Prerequisites

1. **NPM Account**: Create an account at [npmjs.com](https://www.npmjs.com)
2. **Node.js**: Version 18+ recommended
3. **Git Repository**: Your code should be in a Git repository

## 🛠️ Step-by-Step Deployment

### 1. Prepare Your Package

```bash
# Make sure you're in the project directory
cd /path/to/mcp-starter-kit

# Install dependencies
npm install

# Build the project
npm run build

# Test the build
npm start
```

### 2. Update Package Information

Edit `package.json` with your information:

```json
{
  "name": "mcp-starter-kit",  // Make sure this is unique on NPM
  "version": "1.0.0",
  "author": "Shola Jegede <jegedeshola@gmail.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/sholajegede/mcp-starter-kit.git"
  },
  "homepage": "https://github.com/sholajegede/mcp-starter-kit#readme",
  "bugs": {
    "url": "https://github.com/sholajegede/mcp-starter-kit/issues"
  }
}
```

### 3. Login to NPM

```bash
# Login to NPM (you'll be prompted for credentials)
npm login

# Verify you're logged in
npm whoami
```

### 4. Test Your Package Locally

```bash
# Test the package locally
npm pack

# This creates a .tgz file you can test
npm install -g ./mcp-starter-kit-1.0.0.tgz

# Test the CLI
mcp-starter templates
mcp-starter create test-app --template blog

# Uninstall test version
npm uninstall -g mcp-starter-kit
```

### 5. Publish to NPM

```bash
# Publish the package
npm publish

# If this is a scoped package (starts with @), use:
# npm publish --access public
```

### 6. Verify Publication

```bash
# Check your package on NPM
npm view mcp-starter-kit

# Install globally from NPM
npm install -g mcp-starter-kit

# Test the global installation
mcp-starter templates
```

## 🔄 Updating Your Package

When you make changes:

```bash
# Update version in package.json
npm version patch  # for bug fixes
npm version minor # for new features
npm version major # for breaking changes

# Publish the update
npm publish
```

## 📦 Package Structure

Your published package will include:

```
mcp-starter-kit/
├── dist/                    # Compiled JavaScript
├── bin/                     # CLI executable
├── src/                     # Source code
├── README.md               # Documentation
└── package.json            # Package metadata
```

## 🎯 Usage After Deployment

Users can install and use your package:

```bash
# Install globally
npm install -g mcp-starter-kit

# Create a new blog application
mcp-starter create my-blog --template blog

# Create an e-commerce application
mcp-starter create my-store --template ecommerce

# List available templates
mcp-starter templates
```

## 🛡️ Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Use environment variables for all secrets
3. **Dependencies**: Keep dependencies up to date
4. **Permissions**: Ensure proper file permissions for CLI

## 📊 Monitoring Your Package

- **Downloads**: Check download stats on NPM
- **Issues**: Monitor GitHub issues
- **Updates**: Keep dependencies updated
- **Documentation**: Keep README updated

## 🚨 Troubleshooting

### Common Issues:

1. **"Package name already exists"**
   - Choose a different name
   - Use scoped packages (@yourname/package-name)

2. **"Permission denied"**
   - Make sure you're logged in: `npm whoami`
   - Check your NPM permissions

3. **"Build failed"**
   - Fix TypeScript errors: `npm run build`
   - Check all dependencies are installed

4. **"CLI not found"**
   - Ensure `bin` field in package.json is correct
   - Make sure the file is executable

## 🎉 Success!

Once deployed, users can:

```bash
npm install -g mcp-starter-kit
mcp-starter create my-app --template blog
cd my-app
npm install
npm run setup-db
npm run dev
```

Your MCP Starter Kit is now available to the world! 🌍
