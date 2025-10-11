# Contributing to MCP Starter Kit

Thank you for your interest in contributing to MCP Starter Kit! This document provides guidelines and information for contributors.

## Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-starter-kit.git
   cd mcp-starter-kit
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Local Development
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Test the CLI locally
node bin/mcp-starter

# Test with a generated project
npx mcp-starter-kit test-app todo
```

## How to Contribute

### 1. Reporting Issues
- Use the GitHub issue tracker
- Provide clear description and steps to reproduce
- Include environment details (OS, Node version, etc.)

### 2. Suggesting Features
- Open a discussion or issue with the "enhancement" label
- Describe the use case and expected behavior
- Consider implementation complexity

### 3. Submitting Code

#### Code Style
- Follow existing TypeScript patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Ensure all code is properly typed

#### Commit Messages
Use conventional commits format:
```
feat: add new template for e-commerce
fix: resolve SQL parameter binding issue
docs: update README with new examples
test: add unit tests for CLI generation
```

#### Pull Request Process
1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**:
   ```bash
   npm test
   ```
4. **Update version** in package.json if needed
5. **Create pull request** with clear description

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --grep "CLI generation"
```

### Test Coverage
- Aim for >80% test coverage
- Test both success and error cases
- Include integration tests for CLI workflows

## Project Structure

```
mcp-starter-kit/
├── bin/                    # CLI executable
├── src/                   # Source code
│   ├── cli/              # CLI generation logic
│   ├── core/             # Core modules
│   │   ├── auth/         # Authentication
│   │   ├── database/     # Database operations
│   │   ├── server/       # MCP server
│   │   └── tools/        # Tool definitions
│   └── examples/         # Template examples
├── dist/                 # Compiled output
└── tests/                # Test files
```

## Areas for Contribution

### High Priority
- **New Templates**: Add more application templates (CRM, e-commerce, etc.)
- **Authentication Providers**: Support for Auth0, Firebase, Supabase
- **Database Providers**: Support for Supabase, PlanetScale, MongoDB
- **Testing**: Improve test coverage and add E2E tests

### Medium Priority
- **CLI Improvements**: Better error handling, progress indicators
- **Documentation**: More examples, tutorials, video guides
- **Performance**: Optimize generation speed for large projects
- **Internationalization**: Multi-language support

### Low Priority
- **Themes**: Customizable UI themes for generated apps
- **Plugins**: Plugin system for extending functionality
- **Analytics**: Usage tracking and insights

## Development Guidelines

### Adding New Templates
1. Create template config in `src/examples/`
2. Add entity definitions
3. Update CLI template selection
4. Add tests for template
4. Update documentation

### Adding New Features
1. Design the feature thoroughly
2. Create feature branch
3. Implement with tests
4. Update documentation
5. Submit PR with clear description

### Code Review Process
- All PRs require review from maintainers
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Ensure CI passes before requesting review

## Bug Reports

When reporting bugs, please include:

1. **Environment**:
   - OS and version
   - Node.js version
   - npm version

2. **Steps to reproduce**:
   - Exact commands run
   - Expected vs actual behavior
   - Error messages (if any)

3. **Additional context**:
   - Screenshots if relevant
   - Related issues
   - Workarounds found

## Feature Requests

When suggesting features:

1. **Use case**: Describe the problem you're solving
2. **Proposed solution**: How should it work?
3. **Alternatives**: Other approaches considered
4. **Additional context**: Screenshots, mockups, examples

## Release Process

1. **Version bump** in package.json
2. **Update CHANGELOG.md**
3. **Create release tag**
4. **Publish to npm**
5. **Update GitHub releases**

## Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow the golden rule

### Communication
- Use GitHub discussions for questions
- Keep issues focused and actionable
- Be patient with responses
- Help others when you can

## Resources

### Documentation
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Kinde Authentication](https://kinde.com/docs/)
- [Neon Database](https://neon.tech/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Tools
- [VS Code](https://code.visualstudio.com/) - Recommended editor
- [GitHub CLI](https://cli.github.com/) - GitHub integration
- [Commitizen](https://commitizen.github.io/cz-cli/) - Commit message formatting

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in documentation
- Invited to maintainer discussions (for significant contributions

## Contact

- **Issues**: [GitHub Issues](https://github.com/sholajegede/mcp-starter-kit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sholajegede/mcp-starter-kit/discussions)
- **Email**: [jegedeshola@gmail.com](mailto:jegedeshola@gmail.com)

---

Thank you for contributing to MCP Starter Kit!
