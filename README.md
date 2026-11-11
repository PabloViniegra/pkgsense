<p align="center">
  <img src="public/logo.webp" alt="pkgsense logo" width="128" height="128">
</p>

# pkgsense - Package Intelligence for VS Code

**pkgsense** provides intelligent insights into your `package.json` file with real-time diagnostics, automated fixes, and visual enhancements to help you maintain a robust and efficient Node.js project.

## ✨ Features

### 🎯 Core Analysis Features

- **🚨 Deprecated Packages** - Reports the deprecation notice npm publishes for the version your range resolves to, and notes maintenance-mode packages such as `moment`
- **📦 Bundle Size Analysis** - Shows the Bundlephobia size of each production dependency, for the version your range resolves to
- **🔒 Security Scanning** - Runs `npm audit` or `pnpm audit` against your lockfile and links each finding to its advisory
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
  - Open the npm deprecation notice of a deprecated dependency
  - Update to latest versions
  - Add missing metadata fields
  - Fix vulnerabilities with `npm audit fix` or `pnpm audit --fix`

### Diagnostic Levels

- **Error** (🔴): High or critical security vulnerabilities
- **Warning** (🟡): Low or moderate vulnerabilities, packages deprecated on npm, very heavy dependencies (>1MB), engine mismatches, duplicate dependencies, or major updates available
- **Info** (ℹ️): Suggestions for improvement, best practices, bundle sizes, minor/patch updates, and checks that could not run (an audit without a lockfile, a registry lookup that failed), so a missing warning is never mistaken for a clean result

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

1. **View Deprecation Notice**
   ```
   Click on diagnostic → 💡 → "View deprecation notice on npm"
   ```
   Removing the package would not replace what it provides; the notice usually names its successor.

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
   Options: Run npm audit fix / pnpm audit --fix (in the lockfile's directory),
            Update manually (only for advisories against the dependency itself),
            or View on npm
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
| Very heavy | >1MB minified | Warning (🟡) | Yellow squiggly underline |
| Heavy | >200KB minified | Info (ℹ️) | Blue squiggly underline |
| Moderately large | >50KB minified | Info (ℹ️) | Blue squiggly underline |

Only `dependencies` are measured; `devDependencies` do not ship in your bundle.

### Notification Settings

- **Critical Vulnerabilities**: Automatic pop-up notifications
- **Duplicate Prevention**: Same vulnerability won't notify twice per session
- **Action Buttons**: "View Details", "Open npm Page", "Dismiss"

## 🧪 Quality & Testing

- **494 tests** covering every analyzer, the diagnostics and the quick fixes
- **Type-safe** implementation
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

- Vulnerability scanning needs a `package-lock.json` or `pnpm-lock.yaml` next to (or above) the `package.json`, and the matching tool on your PATH. Yarn and Bun lockfiles are not audited
- Vulnerabilities in transitive dependencies are summarised on the direct dependency that brings them in
- In a monorepo the audit runs from the root lockfile and covers the whole workspace: a vulnerability is shown on a package's `package.json` when that package lists the affected dependency, even if the vulnerable copy comes from another workspace package
- In untrusted workspaces the vulnerability audit and engine checks are disabled, since both run programs from the workspace (`npm`/`pnpm`, `node`)
- A version range resolves like npm does: the `latest` tag if it matches and is not deprecated, otherwise the highest matching version that is not deprecated
- Engine checks compare against the `node`/`npm` found on your PATH, which may differ from the one your project runs on
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

### v1.3.0 (Latest)

**Accuracy: every diagnostic is now backed by a source you can check**
- 🔒 Vulnerabilities are read from the real `npm audit` / `pnpm audit` report of your lockfile, attributed to the direct dependency and linked to the advisory
- 🚨 Deprecations come from the npm registry notice for the version your range resolves to, replacing a hardcoded list
- 📜 Licenses are read from the version your range resolves to, not from the latest release
- 📦 Bundle sizes are measured for the resolved version, for production dependencies only; size alone is no longer an error
- 🔧 Engine mismatches report the required range and the version actually found
- ⚙️ Script checks no longer flag `rm -rf` as a security risk or words that merely contain `eval`/`sudo`; piping `curl`/`wget` to a shell is now reported
- 🙈 Private packages are no longer asked for publishing metadata or a `files` field
- 💡 Quick fixes are offered only for the diagnostics they can actually fix, and edit only the affected key, keeping the file's indentation and line endings
- ℹ️ An audit that cannot run, or registry lookups that fail, are reported as info instead of passing silently
- 📍 Diagnostics are placed by parsing the file, so one-line sections and keys repeated in `scripts`/`overrides` no longer misplace them; engine mismatches point at the `engines` entry
- 🔀 A package listed in both `dependencies` and `devDependencies` is checked with the `dependencies` range, the one npm installs
- 📜 Each `UNLICENSED` dependency gets its own warning, and a package that publishes no license is told apart from a failed lookup
- 🛡️ Workspace trust: audit and engine checks only run in trusted workspaces
- ⏱️ Analyses of the same file never overlap; edits are debounced
- 🧪 Tests are now compiled and type-checked on every run (494 total)

### v1.2.0

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
