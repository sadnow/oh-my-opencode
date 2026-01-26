# OpenCode/Oh-My-OpenCode Presets

A collection of curated configuration presets for oh-my-opencode, optimized for different use cases and budget constraints.

## Quick Start

```bash
# Linux/macOS/WSL
./switch-preset.sh balanced

# Windows PowerShell
.\switch-preset.ps1 balanced
```

## Available Presets

| Preset | Cost | Best For | Claude Usage |
|--------|------|----------|--------------|
| `balanced` | Moderate | Daily development, parallel agents | ~10% (oracle only) |
| `best` | High | Critical projects, production code | ~60% (heavy) |
| `free` | $0 | Learning, experimentation | 0% (Copilot only) |
| `maintainer-default` | High | Official recommended experience | ~50% |

---

## Preset Details

### `balanced` (Recommended for most users)

**Philosophy**: Maximize quality-to-cost ratio by intelligently routing tasks to the most cost-effective model that can handle them well.

**Provider Distribution**:
- OpenCode/Zen: ~45% (your $20 balance)
- Antigravity: ~25% (FREE Gemini)
- ChatGPT Plus: ~15% (OAuth)
- Claude: ~10% (oracle/artistry only)
- GitHub Copilot: ~5% (free Claude access)

**Key Model Assignments**:

| Agent | Model | Rationale |
|-------|-------|-----------|
| explore | Antigravity Gemini Flash | FREE, 1M context, fast |
| search | Antigravity Gemini Flash | FREE, multimodal |
| debug | OpenAI GPT-5.2 Codex | Strong debugging from ChatGPT Plus |
| implement | Zen GLM 4.7 | 73.8% SWE-bench, reliable |
| refactor | Zen Qwen Coder 480B | 61.8% Aider, excellent code understanding |
| review | Zen Kimi K2 Thinking | Extended reasoning for deep analysis |
| plan | Antigravity Gemini Pro | FREE, thinking mode |
| oracle | Claude Opus 4.5 | Reserved for hardest problems |
| sisyphus | Zen GLM 4.7 | Main worker, balanced quality/cost |

**Concurrency**: 8 default, 4 OpenCode, 2 ChatGPT, 1 Antigravity, 1 Claude

---

### `best` (Maximum Quality)

**Philosophy**: Use the absolute best model for each task regardless of cost. For critical projects where quality matters more than budget.

**Provider Distribution**:
- Claude: ~60%
- OpenAI: ~20%
- Gemini: ~15%
- Others: ~5%

**Key Model Assignments**:

| Agent | Model | Rationale |
|-------|-------|-----------|
| explore | Gemini 3 Pro High | 2M context, thinking mode |
| debug | GPT-5.2 Codex High | Strong debugging |
| implement | Claude Opus 4.5 | 80.9% SWE-bench (best) |
| refactor | Claude Opus 4.5 | Best abstract reasoning |
| review | Kimi K2 Thinking | 200+ tool calls capability |
| plan | Claude Opus 4.5 | Best strategic planning |
| oracle | Claude Opus 4.5 | Maximum reasoning |
| sisyphus | Claude Opus 4.5 | Per maintainer recommendation |

**Concurrency**: 4 default, 2 Claude Opus, 2 GPT Codex

---

### `free` (Zero Cost)

**Philosophy**: Use only free providers. Quality will be lower but costs nothing.

**Providers Used**:
- Antigravity (Google Gemini) - FREE but rate-limited
- GitHub Copilot - FREE with subscription
- OpenCode Zen free tier - big-pickle, gpt-5-nano

**Key Model Assignments**:

| Agent | Model | Rationale |
|-------|-------|-----------|
| explore | Antigravity Gemini Flash | FREE, fast |
| debug | GitHub Copilot Claude Sonnet | FREE Claude access |
| implement | GitHub Copilot Claude Sonnet | FREE |
| oracle | Antigravity Gemini Pro High | Best FREE reasoning |
| sisyphus | GitHub Copilot Claude Sonnet | FREE |
| background | Zen GPT-5-nano | Ultra cheap |

**Limitations**:
- Antigravity: ~1 concurrent request, rate limits
- Lower quality on complex tasks
- No Claude Opus access

---

### `maintainer-default` (Official Recommendations)

**Philosophy**: Follow the oh-my-opencode maintainer's official recommendations for optimal experience.

**Key Points** (from official docs):
- Sisyphus should use Claude Opus ("using other models may degrade experience")
- Oracle should use GPT-5.2
- Librarian should use big-pickle
- Explore should use cheap models (gpt-5-nano)

**Provider Distribution**:
- Claude: ~50%
- OpenAI: ~20%
- Zen: ~20%
- Gemini: ~10%

---

## Model Research Summary

### Benchmark Comparison

| Model | SWE-bench | Aider | Context | Best For |
|-------|-----------|-------|---------|----------|
| Claude Opus 4.5 | 80.9% | - | 200K | Complex reasoning, production code |
| GPT-5.2 Codex | - | - | 272K | Debugging, tool use |
| Gemini 3 Flash | 78% | - | 1M | Fast exploration, multimodal |
| GLM 4.7 | 73.8% | - | 200K | Balanced coding, token-efficient |
| Qwen Coder 480B | - | 61.8% | 256K | Agentic coding, refactoring |
| Kimi K2 Thinking | 71.3% | - | 256K | Long-horizon planning, 200+ tools |
| GPT-5-nano | - | - | 400K | Ultra-fast simple tasks |

### Model Strengths by Role

**Code Implementation**:
1. Claude Opus 4.5 (best)
2. GLM 4.7 (good value)
3. Qwen Coder 480B (agentic)

**Complex Reasoning**:
1. Claude Opus 4.5
2. Kimi K2 Thinking
3. Gemini 3 Pro High

**Exploration/Search**:
1. Gemini 3 Flash (1M context, fast)
2. GPT-5-nano (ultra cheap)

**Debugging**:
1. GPT-5.2 Codex
2. Claude Opus 4.5
3. Qwen Coder 480B

---

## Configuration Structure

Each preset configures:

### Categories
Task domains with model assignments:
- `visual-engineering` - UI/frontend work
- `artistry` - Creative tasks
- `writing` - Documentation
- `quick` - Simple operations
- `ultrabrain` - Complex reasoning
- `unspecified-high/low` - General tasks

### Agents
Specialized workers:
- `explore` - Codebase exploration
- `librarian` - Documentation/GitHub search
- `debug` - Bug fixing
- `implement` - Code writing
- `refactor` - Code restructuring
- `review` - Code review
- `plan` - Strategic planning
- `oracle` - Hardest problems
- `sisyphus` - Main orchestrator
- `sisyphus-junior` - Helper worker

### Background Task Concurrency
Controls parallel agent limits:
- `providerConcurrency` - Max per provider
- `modelConcurrency` - Max per model

---

## Switching Presets

### Linux/macOS/WSL
```bash
cd ~/.config/opencode/presets
./switch-preset.sh balanced
```

### Windows PowerShell
```powershell
cd $env:USERPROFILE\.config\opencode\presets
.\switch-preset.ps1 balanced
```

### Manual
Copy preset content (minus comments) to ~/.config/opencode/oh-my-opencode.json

---

## Creating Custom Presets

1. Copy an existing preset:
   ```bash
   cp balanced.jsonc my-custom.jsonc
   ```

2. Edit model assignments as needed

3. Switch to it:
   ```bash
   ./switch-preset.sh my-custom
   ```

---

## Provider Authentication

Ensure you have authenticated with required providers:

```bash
# OpenCode native auth
opencode auth login

# Check provider status
oh-my-opencode doctor
```

---

## Troubleshooting

### Changes not taking effect
Restart opencode after switching presets.

### Rate limit errors
- Reduce providerConcurrency for affected provider
- Switch to balanced or free preset

### Model not found
Ensure the provider is authenticated and the model is available in your region/plan.

---

## File Locations

| Platform | Presets Directory |
|----------|-------------------|
| Linux/macOS | ~/.config/opencode/presets/ |
| WSL | ~/.config/opencode/presets/ |
| Windows | %USERPROFILE%\.config\opencode\presets\ |

Active config: ~/.config/opencode/oh-my-opencode.json

---

## Sources

- [oh-my-opencode GitHub](https://github.com/code-yeongyu/oh-my-opencode)
- [OpenCode Documentation](https://opencode.ai/docs/)
- [Qwen Coder Benchmarks](https://qwenlm.github.io/blog/qwen3-coder/)
- [Kimi K2 Technical Report](https://arxiv.org/pdf/2507.20534)
- [GLM 4.7 Benchmarks](https://z.ai/blog/glm-4.7)
- [Gemini 3 Flash](https://blog.google/products/gemini/gemini-3-flash/)
