# pkgsense - Package Intelligence for VS Code

**pkgsense** provides intelligent insights into your `package.json` file with real-time diagnostics, helping you maintain a robust and efficient Node.js project.

## Features

- **🚨 Deprecated Packages** - Detects outdated packages (like `moment`, `request`, `left-pad`) with recommended alternatives
- **📦 Bundle Size Analysis** - Shows real-time package sizes from Bundlephobia API and warns about heavy dependencies
- **🔒 Security Scanning** - Integrates with `npm audit` to detect vulnerabilities
- **✅ Best Practices** - Checks for missing or misconfigured fields (`files`, `type`, test scripts)
- **🔄 Duplicate Detection** - Identifies packages listed in both `dependencies` and `devDependencies`

### Diagnostic Levels

- **Error** (🔴): Critical issues like very large packages (>1MB) or security vulnerabilities
- **Warning** (🟡): Important issues like deprecated packages or heavy dependencies (>200KB)
- **Info** (ℹ️): Suggestions for improvement and best practices

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "pkgsense"
4. Click Install

### From VSIX

1. Download the `.vsix` file from releases
2. Open VS Code Extensions view
3. Click "..." menu → "Install from VSIX..."
4. Select the downloaded file

## Usage

### Automatic Analysis

pkgsense automatically activates when you open a `package.json` file. Analysis runs on:
- File open
- File save
- File changes

### Manual Analysis

Use the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):
1. Type "Analyze package.json"
2. Press Enter

Or use the command ID: `pkgsense.analyze`

## Requirements

- **VS Code**: Version 1.106.1 or higher
- **Node.js**: Version 16+ (for npm audit integration)
- **npm**: Required for vulnerability scanning

## Configuration

pkgsense works out of the box with sensible defaults:

| Threshold | Size | Level |
|-----------|------|-------|
| Large | >1MB | Error |
| Medium | >200KB | Warning |
| Small | >50KB | Info |

## Known Limitations

- Requires `npm` to be installed for vulnerability scanning
- API rate limits may affect large dependency lists
- Sequential API calls (performance optimization pending)

## Contributing

Contributions are welcome! Please ensure:
- All tests pass: `pnpm test`
- Code is formatted: `pnpm run format`
- No linting errors: `pnpm run lint`

See [CLAUDE.md](CLAUDE.md) for detailed coding standards.

## License

See [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Bundlephobia](https://bundlephobia.com/) for package size data
- [npm](https://www.npmjs.com/) for vulnerability scanning

---

**Made with ❤️ for the Node.js community**
