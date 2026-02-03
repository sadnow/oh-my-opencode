# Issue: Upstream Sync Strategy

**Status**: Open - Strategy Documented
**Priority**: Medium
**Created**: 2026-02-02

## Context
Our fork is **1839 commits ahead** of upstream. We've made significant improvements:
- Budget orchestration system
- WebUI dashboard
- Claude Max & Copilot usage tracking
- Test pollution fixes
- Deadlock detection for background agents

We need to carefully sync beneficial upstream changes without breaking our enhancements.

## Current State
```bash
git log --oneline --since="1 week ago" upstream/dev ^origin/dev
# Result: Only 1 commit in last week (CLA signature)
```

Upstream is relatively quiet. Our fork is stable.

## Risk Assessment

### HIGH RISK - Do NOT Merge Blindly
- Budget orchestrator changes (we have major enhancements)
- Agent configuration (we have custom agents)
- Hook system (we fixed test pollution)
- Background agent system (we added deadlock detection)

### MEDIUM RISK - Review Carefully
- Test infrastructure changes
- Shared utilities
- Config schema updates
- Documentation updates

### LOW RISK - Safe to Merge
- Bug fixes in unrelated areas
- Performance improvements
- New features that don't conflict
- Documentation improvements

## Sync Strategy

### Phase 1: Reconnaissance (DO THIS FIRST)
```bash
# 1. Fetch latest upstream
git fetch upstream

# 2. Analyze upstream changes
git log --oneline --graph upstream/dev ^origin/dev

# 3. Identify categories of changes
git log --oneline upstream/dev ^origin/dev --format="%s" | grep -E "^(feat|fix|refactor|test|docs):" | sort | uniq -c

# 4. Check for conflicts
git merge-tree $(git merge-base origin/dev upstream/dev) origin/dev upstream/dev
```

### Phase 2: Cherry-Pick Strategy (RECOMMENDED)
Instead of merging, cherry-pick beneficial commits:

```bash
# 1. Create sync branch
git checkout -b sync-upstream-YYYY-MM-DD origin/dev

# 2. Cherry-pick specific commits
git cherry-pick <commit-hash>

# 3. Test after EACH cherry-pick
bun run typecheck && bun test

# 4. If conflicts, resolve carefully
# 5. Document each picked commit
```

### Phase 3: Selective Integration
For each upstream commit:
1. **Read the commit message and diff**
2. **Assess impact on our features**
3. **Decision matrix:**

| Upstream Change | Our Code | Action |
|----------------|----------|--------|
| Bug fix in shared code | No conflict | ✅ Cherry-pick |
| New feature | No overlap | ✅ Cherry-pick |
| Enhancement to budget | We rewrote it | ❌ Skip or adapt |
| Test infrastructure | We fixed pollution | ⚠️ Review carefully |
| Config schema | We extended it | ⚠️ Merge schemas |

### Phase 4: Testing Protocol
After each integration:
```bash
# 1. Type check
bun run typecheck

# 2. Full test suite
bun test

# 3. WebUI verification
bun run dev:webui
# Visit http://localhost:3847

# 4. Budget orchestrator smoke test
# Run with actual API keys, verify tier selection

# 5. Background agent test
# Verify deadlock detection still works
```

### Phase 5: Documentation
For each integrated change:
- [ ] Update FORK.md with upstream commit reference
- [ ] Document any adaptations made
- [ ] Update CLAUDE.md if patterns changed
- [ ] Add to CHANGELOG.md

## Proposed Workflow

### Weekly Sync Check
```bash
# Every Monday, run:
git fetch upstream
git log --oneline --since="1 week ago" upstream/dev ^origin/dev > .sisyphus/weekly-upstream-changes.txt
# Review and decide which to integrate
```

### Monthly Integration
- Dedicate time to carefully integrate beneficial changes
- Create sync branch
- Cherry-pick commits
- Test thoroughly
- Document everything

## Success Criteria
- [ ] No regressions in our features
- [ ] All tests pass after integration
- [ ] WebUI still works
- [ ] Budget orchestrator intact
- [ ] Deadlock detection functional
- [ ] Documentation updated

## Anti-Patterns to Avoid
❌ `git merge upstream/dev` (too risky)
❌ Batch cherry-picking without testing
❌ Ignoring conflicts
❌ Skipping documentation
❌ Rushing the process

## Priority
Medium - Important but not urgent. Our fork is stable and functional. Upstream is relatively quiet.

## Next Steps
1. Create reconnaissance script
2. Set up weekly sync check automation
3. Monitor upstream activity
4. Integrate beneficial changes carefully when they appear
