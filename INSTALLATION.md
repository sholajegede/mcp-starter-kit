# 📦 Installation Guide

This guide helps you install and use the MCP Starter Kit in different scenarios.

## 🚀 Quick Installation (Recommended)

### Method 1: Use with npx (No Installation)

```bash
# Create a blog application
npx mcp-starter-kit create my-blog --template blog

# Create an e-commerce application
npx mcp-starter-kit create my-store --template ecommerce

# Create a CRM application
npx mcp-starter-kit create my-crm --template crm

# Create a todo application
npx mcp-starter-kit create my-todos --template todo

# List available templates
npx mcp-starter-kit templates
```

**Advantages:**
- ✅ No installation required
- ✅ Always uses the latest version
- ✅ No permission issues
- ✅ Works on any system

## 🔧 Global Installation

### Method 2: Install Globally

```bash
# Install globally
npm install -g mcp-starter-kit

# Now you can use the short command
mcp-starter create my-blog --template blog
mcp-starter templates
```

**If you get permission errors:**

```bash
# Option A: Fix npm permissions (recommended)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
npm install -g mcp-starter-kit

# Option B: Use sudo (not recommended)
sudo npm install -g mcp-starter-kit

# Option C: Use npx instead
npx mcp-starter-kit create my-blog --template blog
```

## 📁 Local Installation

### Method 3: Install in Your Project

```bash
# Create a new directory
mkdir my-mcp-project
cd my-mcp-project

# Install locally
npm install mcp-starter-kit

# Use with npx
npx mcp-starter-kit create my-blog --template blog
```

## 🐳 Docker Installation

### Method 4: Use with Docker

```bash
# Create a Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine
RUN npm install -g mcp-starter-kit
WORKDIR /app
CMD ["mcp-starter", "templates"]
EOF

# Build and run
docker build -t mcp-starter .
docker run -it mcp-starter
```

## 🔍 Troubleshooting

### Common Issues

**1. Permission Denied (EACCES)**
```bash
# Solution: Use npx
npx mcp-starter-kit create my-app --template blog
```

**2. Command Not Found**
```bash
# Make sure you're using the full package name
npx mcp-starter-kit templates
# Not: npx mcp-starter templates
```

**3. Version Conflicts**
```bash
# Clear npm cache
npm cache clean --force

# Use specific version
npx mcp-starter-kit@1.0.2 create my-app --template blog
```

**4. Network Issues**
```bash
# Use a different registry
npm install -g mcp-starter-kit --registry https://registry.npmjs.org/

# Or use yarn
yarn global add mcp-starter-kit
```

## ✅ Verification

After installation, verify it works:

```bash
# Test the CLI
npx mcp-starter-kit templates

# Create a test app
npx mcp-starter-kit create test-app --template blog

# Check the generated files
ls test-app/
```

## 🎯 Next Steps

1. **Choose your template** (blog, ecommerce, crm, todo)
2. **Create your application**
3. **Configure environment variables**
4. **Set up your database**
5. **Start building!**

## 💡 Pro Tips

- **Use npx** for one-off projects
- **Install globally** for frequent use
- **Use specific versions** for production
- **Check the README** for detailed setup instructions

---

**Need help?** Check the main README.md or open an issue on GitHub!
