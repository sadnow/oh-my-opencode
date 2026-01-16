# CLAUDE.md

## Project Overview

Oh-My-AutoCode (formerly Oh-My-OpenCode) is a batteries-included plugin for [OpenCode](https://opencode.ai) that transforms it into a multi-model AI agent orchestration system. It provides curated agents (Sisyphus orchestrator, Oracle consultant, Librarian researcher, Explore fast search), LSP/AST-Grep tools, MCP integrations, and intelligent task routing via the `/autocode` command.

**This fork (sadnow/oh_my_autocode)** adds **Technique Orchestration** - an intelligent auto-router that analyzes tasks and automatically selects optimal technique combinations (direct, ulw, ultrathink, ralph, or combos) with adaptive budget escalation.

## Quick Start

```bash
# Build
bun run build

# Type check
bun run typecheck

# Run tests
bun test

# Run auto-router tests specifically
npx tsx test-auto-router.ts
```

## Architecture

```
src/
├── agents/           # AI agents: Sisyphus, oracle, librarian, explore, frontend, etc.
├── hooks/            # 22+ lifecycle hooks including auto-router
│   └── auto-router/  # /autocode command hook - intelligent task routing
├── features/
│   └── auto-router/  # Core auto-router logic (~3,500 LOC)
│       ├── index.ts           # Main createAutoRouter() function
│       ├── classifier.ts      # Task complexity classification
│       ├── technique-selector.ts  # Technique selection matrix
│       ├── escalation-manager.ts  # Budget tier escalation
│       ├── judge-rubrics.ts   # LLM-as-judge evaluation
│       ├── analytics.ts       # Technique effectiveness tracking
│       ├── preset-selector.ts # Development preset auto-application
│       ├── wizard.ts          # Interactive wizard configuration
│       ├── production-ready.ts # Completion checklist verification
│       └── constants.ts       # Budget tiers, techniques, presets
├── tools/            # LSP, AST-Grep, Grep, Glob tools
├── mcp/              # MCP configs: context7, grep_app, websearch
└── config/           # Zod schema, TypeScript types
```

## Conventions

### Naming
- **Directories**: kebab-case (`auto-router`, `claude-code-loader`)
- **Factories**: `createXXXHook()`, `createXXXTool()` pattern
- **Types**: PascalCase interfaces, explicit exports

### Code Style
- **Package manager**: Bun only (`bun run`, `bun test`, `bunx`)
- **Temperature**: 0.1 for code agents (max 0.3)
- **Exports**: Barrel pattern in index.ts
- **Testing**: BDD comments `#given/#when/#then`

### Auto-Router Specific
- **Budget tiers**: `free` → `cheap` → `moderate` → `expensive` → `maximum`
- **Techniques**: `direct` < `ulw`/`ultrathink`/`ralph` < combos < `triple`
- **Quality thresholds**: 0.6 (prototype) to 0.85 (security)

## Anti-Patterns

**NEVER do these:**
- Use npm/yarn instead of bun
- Use @types/node instead of bun-types
- Trust agent self-reports without verification
- Skip TODO creation for multi-step tasks
- Use year 2024 in code/prompts
- Make giant commits (3+ files = 2+ commits)
- Rush completion without verification
- Use temperature > 0.3 for code agents

## Common Tasks

### Add a New Budget Tier
1. Edit `src/features/auto-router/constants.ts` - add to `BUDGET_TIERS`
2. Edit `src/features/auto-router/types.ts` - update `BudgetTier` union
3. Add escalation rules if needed

### Add a New Technique
1. Edit `src/features/auto-router/types.ts` - add to `TechniqueCombo`
2. Edit `src/features/auto-router/constants.ts`:
   - Add to `TECHNIQUE_SELECTION_MATRIX`
   - Add to `TECHNIQUE_INSTRUCTIONS`
3. Edit `src/features/auto-router/technique-selector.ts` - add description

### Add a New Development Preset
1. Edit `src/features/auto-router/constants.ts` - add to `DEVELOPMENT_PRESETS`
2. Edit `src/features/auto-router/preset-selector.ts` - add mapping if needed

### Run Auto-Router Tests
```bash
npx tsx test-auto-router.ts
```
Expected: 35+ tests passing

## Current Focus

**Status**: v3.8.0 - Major Rename & Enhancements

### v3.8.0 Changes
1. Renamed: oh-my-opencode → oh_my_autocode
2. Renamed: /auto → /autocode (with deprecation warning for /auto)
3. Added: Model deployment notifications
4. Added: Spending tracking with $1 milestones
5. Added: Model ID validation to catch typos
6. Added: Verbose ralph-loop logging

### Key Files
- `src/features/auto-router/wizard.ts` - Interactive wizard logic
- `src/features/auto-router/production-ready.ts` - Completion checklist
- `src/hooks/auto-router/index.ts` - Hook integration with ralph-loop

## AutoCode Usage

### Basic Usage
```
/autocode "fix the login bug"           # Auto-classifies and routes
/autocode "build user auth system"      # Detects complexity, picks technique
```

### Magic Keywords
```
/autocode ultrawork: task description   # Forces ulw + moderate budget
/autocode deepthink: complex algorithm  # Forces ultrathink + expensive
/autocode fullsend: critical refactor   # Forces triple + maximum
```

### Configuration (oh_my_autocode.json)
```json
{
  "auto_router": {
    "enabled": true,
    "default_budget": "free",
    "auto_escalate": true,
    "max_escalations": 3,
    "quality_threshold": 0.7
  }
}
```

## Testing

### Test File Location
`test-auto-router.ts` at project root

### Test Categories (35 total)
1. **Core Tests** (8): Classification, technique selection, budget routing
2. **Edge Cases** (10): Empty input, long input, special characters, free tier, boundaries
3. **Integration Tests** (7): End-to-end flow, project detection, judge rubrics
4. **Wizard Tests** (6): Questions, config building, presets, flags, state machine
5. **Production-Ready Tests** (4): Default checks, verification, judge check, report formatting

### Running Tests
```bash
# Full test suite
npx tsx test-auto-router.ts

# Type check only
bun run typecheck
```

## Deployment

**GitHub Actions workflow_dispatch only**

1. Never modify package.json version locally
2. Commit & push changes
3. Trigger: `gh workflow run publish -f bump=patch`

## Unique Features (This Fork)

| Feature | Description |
|---------|-------------|
| **Technique Combinations** | 10 strategies: direct → ulw → ultrathink → ralph → combos → triple |
| **Stuck Detection** | Same error + same hash = deadlock detection |
| **Domain Quality Thresholds** | Crypto: 0.85+, Security: 0.8+, Prototype: 0.6 |
| **Project-Type Rubrics** | API design weighted 5x for APIs |
| **Model + Technique Co-Selection** | Picks both model AND technique together |
| **Adaptive Budget Escalation** | AND/OR rules: `stuck-pattern AND quality < 0.7` |
