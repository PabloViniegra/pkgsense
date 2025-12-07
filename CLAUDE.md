# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pkgsense is a VS Code extension that analyzes `package.json` files in real-time, providing insights about dependencies, vulnerabilities, bundle sizes, and best practices. It transforms the package.json into an interactive dashboard with diagnostic warnings and suggestions.

## Development Commands

**Build & Development:**
- `pnpm run compile` - Compile TypeScript to JavaScript (output: `./out/`)
- `pnpm run watch` - Watch mode for development (auto-recompile on changes)

**Linting & Formatting:**
- `pnpm run lint` - Lint codebase with Biome
- `pnpm run format` - Format code with Biome (single quotes, recommended rules)

**Testing:**
- `pnpm run test` - Run tests (automatically compiles and lints first)
- `pnpm run pretest` - Run before tests (compile + lint)

**Publishing:**
- `pnpm run vscode:prepublish` - Prepares extension for publishing (runs compile)

## Architecture

### Extension Lifecycle (src/extension.ts)
The extension activates on JSON files and listens for document open/save/change events. When a `package.json` file is detected:
1. Calls `analyzePackageDocument()` from the manager
2. Displays findings via `DiagnosticsManager` as VS Code diagnostics

### Analysis Pipeline (src/analyzers/manager.ts)
The analysis manager orchestrates three parallel analyzers:
1. **Heuristics Analyzer** (`heuristicsAnalyzer.ts`) - Detects deprecated packages (moment, request, left-pad), duplicate dependencies, missing test scripts, missing "files" field, and missing "type" field
2. **Weight Analyzer** (`weightAnalyzer.ts`) - Fetches bundle size data from Bundlephobia API for each dependency
3. **Vulnerability Analyzer** (`vulnerabilityAnalyzer.ts`) - Checks for security vulnerabilities

All findings are aggregated and passed to the DiagnosticsManager.

### Key Components
- **DiagnosticsManager** (`src/decorators/diagnostics.ts`) - Converts `Finding` objects into VS Code diagnostics and manages the diagnostic collection
- **Finding type** (`src/types.ts`) - Shared interface for all analyzer results with severity levels (info/warning/error)
- **Bundlephobia utility** (`src/utils/bundlephobia.ts`) - API integration for package size data

### Data Flow
```
package.json change → analyzePackageDocument() →
  [heuristicsAnalyzer, weightAnalyzer, vulnerabilityAnalyzer] (parallel) →
    findings[] → DiagnosticsManager → VS Code diagnostics UI
```

## VS Code Extension Specifics

- **Activation**: Triggers on `onLanguage:json` (see `activationEvents` in package.json)
- **Entry point**: `./out/extension.js` (compiled from src/extension.ts)
- **Command**: `pkgsense.analyze` - Manually trigger analysis on active package.json
- **Target VS Code version**: ^1.106.1

## TypeScript Configuration

- Module: Node16
- Target: ES2022
- Strict mode enabled
- Output directory: `./out/`
- Source maps enabled for debugging

## Code Quality Standards

### Single Responsibility Principle

**Files**: Each file should have a single, well-defined purpose. If a file exceeds 300 lines, consider splitting it into multiple focused modules.
- `entities.ts` contains only entity factories and domain services
- `repositories.ts` contains only repository implementations
- `useCases.ts` contains only use case functions

**Functions**: Maximum 50 lines of code per function. If a function exceeds this limit:
1. Extract helper functions with descriptive names
2. Consider if the function is doing too many things
3. Break complex logic into smaller, composable units

**Classes/Factories**: Each class should have a single reason to change. UserFactory only creates/updates users, MessageFactory only handles messages.

### Function Complexity Rules

**Cyclomatic Complexity**: Maximum 10 decision points per function. Reduce by:
- Extracting validation logic into separate functions
- Using early returns to reduce nesting
- Replacing complex conditionals with strategy pattern or lookup tables

**Nesting Depth**: Maximum 3 levels of indentation. Beyond this:
- Extract nested logic into helper functions
- Use early returns/guard clauses
- Flatten promise chains with async/await

**Function Parameters**: Maximum 3 parameters. If more needed:
- Group related parameters into an options object
- Use builder pattern for complex object creation
- Consider if the function has too many responsibilities

### Code Organization

**Pure Functions First**: Prefer pure functions (no side effects) over stateful operations:
- Domain layer must be entirely pure
- Use cases coordinate side effects but keep logic pure where possible
- Helper functions should be pure and testable in isolation

**Dependency Injection**: Never use `new` or direct imports for dependencies in business logic:
- Pass repositories through UnitOfWork parameter
- Pass event emitter as parameter to use cases
- Use factory functions for entity creation

**No Magic Numbers**: Extract all constants to `shared/constants.ts`:
```typescript
// Bad
if (state.messageCount > 30) { ... }

// Good
if (state.messageCount > CONSTANTS.RATE_LIMIT_MESSAGES_PER_MINUTE) { ... }
```

### Type Safety

**No `any` Type**: Never use `any`. Use `unknown` for truly dynamic data and validate with Zod:
```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  const validated = SomeSchema.safeParse(data);
  if (!validated.success) return failure(...);
  // Use validated.data
}
```

**Exhaustive Switch Statements**: Use discriminated unions and ensure all cases are handled:
```typescript
switch (event.type) {
  case "JOIN_ROOM": ...
  case "SEND_MESSAGE": ...
  // TypeScript will error if a case is missing
  default: {
    const _exhaustive: never = event;
    return _exhaustive;
  }
}
```

**Avoid Type Assertions**: Don't use `as` unless absolutely necessary. Use type guards instead:
```typescript
// Bad
const user = data as User;

// Good
function isUser(data: unknown): data is User {
  return typeof data === "object" && data !== null && "id" in data;
}
if (isUser(data)) { /* use data as User */ }
```

### Error Handling Standards

**Result Type Everywhere**: All operations that can fail should return `Result<T, E>`:
```typescript
// Use cases always return Result
async function sendMessage(...): Promise<Result<MessageDTO, UseCaseError>>

// Check success before accessing data
if (!result.success) {
  return failure(result.error);
}
// Now result.data is safely accessible
```

**Descriptive Error Codes**: Use semantic error codes from the `ErrorCode` type, not generic strings.

**No Silent Failures**: Always handle errors explicitly. Never use empty catch blocks.
- Usa siempre pnpm para los comandos