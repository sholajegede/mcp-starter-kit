#!/bin/bash

# GitHub Deployment Script for mcp-starter-kit
# This script prepares the repository for GitHub deployment

echo "🚀 Preparing mcp-starter-kit for GitHub deployment..."

# Clean up unnecessary files
echo "🧹 Cleaning up repository..."
rm -rf node_modules/
rm -f test-*.js
rm -rf test-sql-fix/
rm -f mcp-starter-kit-*.tgz
rm -f setup.sh

# Remove any .env files (use .env.example instead)
rm -f .env
rm -f .env.local
rm -f .env.production

# Clean up any temporary files
find . -name "*.log" -delete
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete

echo "✅ Cleanup completed!"

# Verify essential files exist
echo "🔍 Verifying essential files..."

required_files=(
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "README.md"
    "INSTALLATION.md"
    "bin/mcp-starter"
    "src/cli/create-app.ts"
    "dist/cli/create-app.js"
    "src/core/auth/index.ts"
    "src/core/database/index.ts"
    "src/core/server/index.ts"
    "src/core/tools/index.ts"
    "dist/core/auth/index.js"
    "dist/core/database/index.js"
    "dist/core/server/index.js"
    "dist/core/tools/index.js"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All essential files present!"
else
    echo "❌ Missing essential files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

# Test the build
echo "🔨 Testing build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Show repository structure
echo "📁 Repository structure:"
echo "├── bin/mcp-starter (CLI executable)"
echo "├── src/ (TypeScript source)"
echo "├── dist/ (Compiled JavaScript)"
echo "├── package.json (Package configuration)"
echo "├── README.md (Documentation)"
echo "└── .gitignore (Git ignore rules)"

echo ""
echo "🎉 Repository is ready for GitHub deployment!"
echo ""
echo "Next steps:"
echo "1. git add ."
echo "2. git commit -m 'Initial release of mcp-starter-kit'"
echo "3. git push origin main"
echo ""
echo "After pushing to GitHub:"
echo "1. Create a release tag"
echo "2. Publish to npm: npm publish"
