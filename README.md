# pkgsense - Package Intelligence for VS Code

**pkgsense** provides intelligent insights into your `package.json` file with real-time diagnostics, automated fixes, and visual enhancements to help you maintain a robust and efficient Node.js project.

## ✨ Features

### 🎯 Core Analysis Features

- **🚨 Deprecated Packages** - Detects outdated packages (like `moment`, `request`, `left-pad`) with recommended alternatives
- **📦 Bundle Size Analysis** - Shows real-time package sizes from Bundlephobia API and warns about heavy dependencies
- **🔒 Security Scanning** - Integrates with `npm audit` to detect vulnerabilities
- **🔄 Update Detection** - Identifies outdated dependencies with available updates (major/minor/patch)
- **📝 Metadata Validation** - Checks for missing recommended fields (description, keywords, author, license, repository, bugs, homepage)
- **⚙️ Script Analysis** - Detects dangerous commands and inefficient patterns in npm scripts
- **📜 License Compliance** - Validates licenses and detects copyleft/incompatibility issues
- **🔧 Engine Requirements** - Validates Node.js and npm version compatibility
- **🕸️ Dependency Graph** - Analyzes dependency counts and detects version conflicts
- **✅ Best Practices** - Checks for missing or misconfigured fields (`files`, `type`, test scripts)
- **🔄 Duplicate Detection** - Identifies packages listed in both `dependencies` and `devDependencies`

### 🎨 Visual Enhancements (v1.1.0)

- **📊 Progress Indicators** - Real-time progress feedback during long-running analysis
- **🚨 Smart Notifications** - Pop-up alerts for critical vulnerabilities with quick actions
- **🎨 Enhanced Color Coding**
  - Deprecated packages appear with ~~strikethrough~~ styling
  - Duplicate dependencies appear faded
  - Related information links to npm packages
- **💡 Quick Fix Actions** - One-click solutions for common issues:
  - Remove deprecated dependencies
  - Update to latest versions
  - Add missing metadata fields
  - Fix vulnerabilities with npm audit

### Diagnostic Levels

- **Error** (🔴): Critical issues like very large packages (>1MB), security vulnerabilities, or engine mismatches
- **Warning** (🟡): Important issues like deprecated packages, heavy dependencies (>200KB), or major updates available
- **Info** (ℹ️): Suggestions for improvement, best practices, and minor/patch updates

## 🚀 Installation

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

## 📖 Usage

### Automatic Analysis

pkgsense automatically activates when you open a `package.json` file. Analysis runs on:
- File open
- File save
- File changes (with debouncing)

The extension shows a **progress indicator** in the status bar while analyzing.

### Manual Analysis

Use the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):
1. Type "Analyze package.json"
2. Press Enter

Or use the command ID: `pkgsense.analyze`

### Quick Fix Actions

When diagnostics appear in your `package.json`, look for the 💡 lightbulb icon:

1. **Remove Deprecated Dependency**
   ```
   Click on diagnostic → 💡 → "Remove deprecated dependency"
   ```

2. **Update to Latest Version**
   ```
   Click on diagnostic → 💡 → "Update to latest version"
   ```

3. **Add Missing Metadata**
   ```
   Click on diagnostic → 💡 → "Add missing field"
   ```

4. **Fix Vulnerability**
   ```
   Click on diagnostic → 💡 → "Fix vulnerability"
   Options: Run npm audit fix, Update manually, or View on npm
   ```

### Available Commands

| Command | Description |
|---------|-------------|
| `pkgsense.analyze` | Manually trigger analysis on current package.json |
| `pkgsense.removeDependency` | Remove a dependency from package.json |
| `pkgsense.updateDependency` | Update a dependency to its latest version |
| `pkgsense.addMetadataField` | Add a missing metadata field with defaults |
| `pkgsense.fixVulnerability` | Fix a vulnerability with guided options |

## 📋 Requirements

- **VS Code**: Version 1.106.1 or higher
- **Node.js**: Version 16+ (for npm audit integration)
- **npm**: Required for vulnerability scanning and registry queries
- **Internet Connection**: Required for Bundlephobia API and npm registry access

## ⚙️ Configuration

pkgsense works out of the box with sensible defaults. You can customize analyzer behavior through VS Code settings.

### Analyzer Settings (v1.2.0)

Access settings via: **File > Preferences > Settings** (or **Code > Settings** on macOS), then search for "pkgsense".

#### Global Analyzer Control

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pkgsense.enableAnalyzers` | boolean | `true` | Master switch to enable/disable all analyzers. When disabled, no analysis will be performed. |

#### Individual Analyzer Control

Each analyzer can be enabled/disabled individually when `pkgsense.enableAnalyzers` is `true`:

| Setting | Analyzer | Default | Description |
|---------|----------|---------|-------------|
| `pkgsense.analyzers.heuristics` | Heuristics | `true` | Detects deprecated packages, duplicate dependencies, missing scripts |
| `pkgsense.analyzers.weight` | Bundle Size | `true` | Fetches package size data from Bundlephobia |
| `pkgsense.analyzers.vulnerability` | Security | `true` | Checks for security vulnerabilities via npm audit |
| `pkgsense.analyzers.metadata` | Metadata | `true` | Validates package.json metadata fields |
| `pkgsense.analyzers.script` | Scripts | `true` | Analyzes npm scripts for issues |
| `pkgsense.analyzers.license` | License | `true` | Checks dependency licenses for compliance |
| `pkgsense.analyzers.update` | Updates | `true` | Detects outdated dependencies |
| `pkgsense.analyzers.engine` | Engine | `true` | Validates Node.js and npm version requirements |
| `pkgsense.analyzers.dependencyGraph` | Dependency Graph | `true` | Analyzes dependency relationships and conflicts |

#### Example Configuration

```json
{
  "pkgsense.enableAnalyzers": true,
  "pkgsense.analyzers.weight": false,
  "pkgsense.analyzers.vulnerability": true
}
```

This configuration enables analysis but skips bundle size checks (useful for offline environments).

### Package Size Thresholds

| Threshold | Size | Level | Visual Effect |
|-----------|------|-------|---------------|
| Very Large | >1MB | Error (🔴) | Red squiggly underline |
| Large | >200KB | Warning (🟡) | Yellow squiggly underline |
| Medium | >50KB | Info (ℹ️) | Blue squiggly underline |

### Notification Settings

- **Critical Vulnerabilities**: Automatic pop-up notifications
- **Duplicate Prevention**: Same vulnerability won't notify twice per session
- **Action Buttons**: "View Details", "Open npm Page", "Dismiss"

## 🧪 Quality & Testing

- **442 Tests** passing with 100% success rate
- **Type-safe** implementation with no `any` types
- **Code Quality**: All functions under 50 lines
- **Linting**: Clean with Biome
- **Test Coverage**: Comprehensive unit tests for all features

```bash
# Run tests
pnpm run test

# Compile TypeScript
pnpm run compile

# Format code
pnpm run format

# Lint code
pnpm run lint
```

## 📦 Architecture

pkgsense uses a modular analyzer architecture:

- **9 Specialized Analyzers** running in parallel:
  1. Heuristics Analyzer (deprecated packages, duplicates)
  2. Weight Analyzer (bundle sizes)
  3. Vulnerability Analyzer (security issues)
  4. Metadata Analyzer (missing fields)
  5. Script Analyzer (dangerous commands)
  6. License Analyzer (compliance)
  7. Update Analyzer (outdated packages)
  8. Engine Analyzer (Node.js/npm versions)
  9. Dependency Graph Analyzer (conflicts, heavy deps)

- **Visual Enhancement System**:
  - DiagnosticsManager (enhanced color coding)
  - NotificationManager (smart alerts)
  - CodeActionProvider (quick fixes)
  - Command handlers (automated repairs)

## 🔧 Known Limitations

- Requires `npm` to be installed for vulnerability scanning
- API rate limits may affect large dependency lists (>100 packages)
- Network connectivity required for real-time data
- npm registry timeout set to 5 seconds per package

## 🤝 Contributing

Contributions are welcome! Please ensure:

- All tests pass: `pnpm test`
- Code is formatted: `pnpm run format`
- No linting errors: `pnpm run lint`
- Follow single responsibility principle
- Functions under 50 lines
- No `any` types - use proper TypeScript typing


### Development Setup

```bash
# Install dependencies
pnpm install

# Watch mode for development
pnpm run watch

# Run extension in debug mode
Press F5 in VS Code

# Package extension
pnpm run package
```

## 📝 Changelog

### v1.2.0 (Latest)

**Parametrization & Configuration**
- ⚙️ Added global analyzer enable/disable switch (`pkgsense.enableAnalyzers`)
- 🎛️ Individual analyzer configuration for all 9 analyzers
- 🔄 Real-time configuration updates without VS Code reload
- 🧹 Automatic diagnostic cleanup when analyzers are disabled
- 📚 Comprehensive configuration documentation

### v1.1.0

**Phase 2: Visual Enhancements**
- ✨ Added progress indicators for long-running analysis
- 🚨 Implemented smart notification system for critical vulnerabilities
- 🎨 Enhanced color coding with strikethrough and faded styles
- 💡 Added CodeActionProvider with quick fix suggestions
- ⚙️ Implemented 4 automated command handlers
- 🧪 Added 61 new unit tests (442 total)

**Phase 1: Enhanced Analysis**
- ✨ Added 6 new analyzers (metadata, scripts, license, updates, engines, dependency graph)
- 📊 Comprehensive analysis across 9 specialized analyzers
- 🔍 Detection of 20+ issue types
- 🏗️ Improved architecture with Result type pattern

### v1.0.0

- 🎉 Initial release
- 3 core analyzers (heuristics, weight, vulnerability)
- Basic diagnostic system

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Bundlephobia](https://bundlephobia.com/) for package size data
- [npm](https://www.npmjs.com/) for vulnerability scanning and registry API
- [VS Code Extension API](https://code.visualstudio.com/api) for the powerful extensibility platform

---

**Made with ❤️ for the Node.js community**

*Star ⭐ this project on GitHub if you find it useful!*
