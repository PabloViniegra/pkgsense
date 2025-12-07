# pkgsense - Package Intelligence for VS Code

**pkgsense** is an essential VS Code extension for any Node.js project, offering deep and intelligent insights into your `package.json` file. Transform your package configuration into an interactive dashboard with real-time diagnostics, ensuring your project is robust, efficient, and always up-to-date.

## Features

### Real-time Package Analysis

pkgsense automatically analyzes your `package.json` file and provides instant feedback through VS Code diagnostics:

- **Deprecated Package Detection**: Identifies deprecated or unmaintained packages (like `moment`, `request`, `left-pad`) with recommended alternatives
- **Bundle Size Analysis**: Fetches real-time package sizes from Bundlephobia API and warns about heavy dependencies
- **Vulnerability Scanning**: Integrates with `npm audit` to detect security vulnerabilities in your dependencies
- **Best Practices**: Checks for missing or misconfigured fields like `files`, `type`, and `test` scripts
- **Duplicate Detection**: Identifies packages listed in both `dependencies` and `devDependencies`

### Diagnostic Severity Levels

- **Error** (🔴): Critical issues like very large packages (>1MB) or security vulnerabilities
- **Warning** (🟡): Important issues like deprecated packages or moderately heavy dependencies (>200KB)
- **Info** (ℹ️): Suggestions for improvement like missing fields or best practice recommendations

## Installation

### From VSIX (Development)

1. Download the latest `.vsix` file from releases
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
4. Click the "..." menu → "Install from VSIX..."
5. Select the downloaded file

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd pkgsense

# Install dependencies
pnpm install

# Build the extension
pnpm run compile

# Package the extension (optional)
pnpm vsce package
```

## Usage

### Automatic Analysis

pkgsense automatically activates when you open a `package.json` file. Analysis runs on:

- File open
- File save
- File changes (while editing)

### Manual Analysis

You can manually trigger analysis using the command palette:

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Analyze package.json"
3. Press Enter

Alternatively, use the command ID: `pkgsense.analyze`

## Configuration

Currently, pkgsense works out of the box with no configuration required. The extension uses sensible defaults:

- Package size thresholds:
  - Large: >1MB (Error)
  - Medium: >200KB (Warning)
  - Small: >50KB (Info)
- npm audit timeout: 30 seconds
- Bundlephobia API timeout: 5 seconds

## Requirements

- **VS Code**: Version 1.106.1 or higher
- **Node.js**: Recommended version 16+ (for `npm audit` integration)
- **npm**: Required for vulnerability scanning

## Extension Architecture

pkgsense follows a modular analyzer architecture:

```
┌──────────────────────────────────────┐
│         package.json File            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│       Analysis Manager               │
│  (Orchestrates parallel analysis)    │
└──────┬───────┬───────┬───────────────┘
       │       │       │
       ▼       ▼       ▼
   ┌────┐  ┌────┐  ┌────┐
   │ H  │  │ W  │  │ V  │  Analyzers
   └─┬──┘  └─┬──┘  └─┬──┘
     │       │       │
     └───────┴───────┘
             │
             ▼
   ┌─────────────────────┐
   │ Diagnostics Manager │
   │  (VS Code UI)       │
   └─────────────────────┘
```

**Analyzers:**
- **H**: Heuristics Analyzer (deprecated packages, missing fields, best practices)
- **W**: Weight Analyzer (bundle sizes via Bundlephobia API)
- **V**: Vulnerability Analyzer (npm audit integration)

## Development

### Project Structure

```
pkgsense/
├── src/
│   ├── analyzers/          # Analysis logic
│   │   ├── manager.ts      # Orchestrates analyzers
│   │   ├── heuristicsAnalyzer.ts
│   │   ├── weightAnalyzer.ts
│   │   ├── vulnerabilityAnalyzer.ts
│   │   └── types.ts        # Shared analyzer types
│   ├── decorators/         # VS Code integration
│   │   └── diagnostics.ts  # Diagnostic management
│   ├── shared/             # Shared utilities
│   │   ├── constants.ts    # Configuration constants
│   │   └── result.ts       # Result type for error handling
│   ├── utils/              # External API clients
│   │   └── bundlephobia.ts
│   ├── types.ts            # Core type definitions
│   └── extension.ts        # Extension entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Build Commands

```bash
# Development
pnpm run compile        # Compile TypeScript
pnpm run watch          # Watch mode for development

# Quality
pnpm run lint           # Run Biome linter
pnpm run format         # Format code with Biome

# Testing
pnpm run test           # Run tests (includes compile + lint)
pnpm run pretest        # Pre-test setup

# Publishing
pnpm run vscode:prepublish  # Prepare for publishing
```

### Code Quality Standards

The project follows strict coding standards documented in `CLAUDE.md`:

- **SOLID Principles**: Single Responsibility, Open/Closed, Dependency Inversion
- **Type Safety**: Strict TypeScript with no `any` types, exhaustive pattern matching
- **Error Handling**: Result pattern for explicit error handling
- **Function Complexity**: Max 50 lines per function, max 3 nesting levels
- **Pure Functions**: Prefer stateless, side-effect-free functions

### Adding a New Analyzer

1. Create a new analyzer file in `src/analyzers/`
2. Implement the `Analyzer` interface from `types.ts`
3. Create a factory function following the existing pattern
4. Add to `createDefaultAnalyzers()` in `manager.ts`
5. Write tests for your analyzer

Example:

```typescript
export function createMyAnalyzer(): Analyzer {
  return {
    name: 'my-analyzer',
    async analyze(context: AnalysisContext) {
      const findings: Finding[] = [];
      // Your analysis logic here
      return success(findings);
    },
  };
}
```

## Known Issues

- Sequential API calls to Bundlephobia (performance optimization pending)
- No caching of API responses (may hit rate limits with large dependency lists)
- Requires `npm` to be installed for vulnerability scanning

## Roadmap

- [ ] Add caching for Bundlephobia API responses
- [ ] Implement rate limiting for external API calls
- [ ] Add configuration options for thresholds
- [ ] Support for alternative package managers (yarn, pnpm)
- [ ] Quick fixes and code actions for common issues
- [ ] Package update suggestions
- [ ] License compatibility checking

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `pnpm test`
2. Code is formatted: `pnpm run format`
3. No linting errors: `pnpm run lint`
4. TypeScript compiles without errors: `pnpm run compile`
5. Follow the coding standards in `CLAUDE.md`

## Security

pkgsense takes security seriously:

- ✅ No shell injection vulnerabilities (uses `execFile` instead of `exec`)
- ✅ Input validation on all external data
- ✅ Timeout protection on all external API calls
- ✅ Sandboxed npm audit execution

Found a security issue? Please report it privately via GitHub Security Advisories.

## License

See [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Bundlephobia](https://bundlephobia.com/) for package size data
- [npm](https://www.npmjs.com/) for vulnerability scanning
- VS Code team for the excellent extension API

---

**Made with ❤️ for the Node.js community**
