# Git Branch Workflow Guide

## Creating Version Sub-Branches

To create a new sub-branch for each version/commit under the Yair branch:

### Quick Command
```bash
# 1. Make sure you're on the Yair branch with all changes committed
git checkout Yair
git add -A
git commit -m "Your commit message"

# 2. Create a new version sub-branch with a descriptive name
git checkout -b Yair-v1.0.9.2-description

# 3. Push the sub-branch to remote
git push -u origin Yair-v1.0.9.2-description

# 4. Go back to Yair branch to continue working
git checkout Yair
```

### Naming Convention
Use this pattern: `Yair-v{version}-{description}`

Examples:
- `Yair-v1.0.9.1-restored` - Restored features version
- `Yair-v1.0.9.2-fix-wake-time` - Fixed wake-up time input
- `Yair-v1.0.10.0-new-feature` - Added new feature

## Finding the Latest Version Chronologically

### Option 1: List branches by last commit date (LOCAL)
```bash
git for-each-ref --sort=-committerdate refs/heads/ --format='%(committerdate:short) %(refname:short) %(subject)'
```

### Option 2: List remote branches by last commit date
```bash
git for-each-ref --sort=-committerdate refs/remotes/origin/ --format='%(committerdate:short) %(refname:short) %(subject)'
```

### Option 3: List all branches (local + remote) chronologically
```bash
git branch -a --sort=-committerdate
```

### Option 4: List only Yair-related branches chronologically
```bash
git for-each-ref --sort=-committerdate --format='%(committerdate:short) %(refname:short) %(subject)' | grep Yair
```

## Checking Out a Specific Version

To switch to a specific version branch:
```bash
git checkout Yair-v1.0.9.1-restored
```

To see what's different between versions:
```bash
git diff Yair-v1.0.9.1-restored..Yair-v1.0.9.2-description
```

## Merging a Version Back to Yair

If you want to merge a version branch back into Yair:
```bash
git checkout Yair
git merge Yair-v1.0.9.2-description
git push origin Yair
```

## Quick Reference

- **List latest branches**: `git for-each-ref --sort=-committerdate refs/heads/ --format='%(committerdate:short) %(refname:short)'`
- **Current branch**: `git branch --show-current`
- **All branches**: `git branch -a`
- **Yair branches only**: `git branch | grep Yair`

