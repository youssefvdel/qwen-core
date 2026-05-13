name: git
description: "Git best practices and workflows"
version: "1.0.0"
triggers: ["git", "commit", "branch", "merge", "rebase", "version control"]

## Core Principles

1. **Atomic Commits**: Each commit should represent a single logical change
2. **Clear Messages**: Use conventional commits format
3. **Branch Strategy**: Feature branches from main, merge via PR
4. **Review Before Commit**: Always check diffs

## Conventional Commits Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build/config changes

### Examples
```
feat(auth): add password reset functionality

Implemented password reset flow with email verification.
- Added reset token generation
- Created reset email template
- Added rate limiting

Closes #123

feat(api): add user profile endpoint

fix(ui): resolve button alignment issue on mobile

refactor(database): optimize query performance

docs(readme): update installation instructions
```

## Workflow Commands

### Starting Work
```bash
git checkout main
git pull origin main
git checkout -b feat/feature-name
```

### During Work
```bash
git status                    # Check status
git diff                      # Review changes
git add <files>              # Stage changes
git commit -m "type: message" # Commit
```

### Before Push
```bash
git fetch origin
git rebase origin/main       # Rebase on latest
git diff main                # Review full changes
git log --oneline            # Check commit history
```

### Completing Work
```bash
git push -u origin feat/feature-name
# Create Pull Request
```

## Safety Commands

### Undo Last Commit (Keep Changes)
```bash
git reset --soft HEAD~1
```

### Discard Uncommitted Changes
```bash
git checkout -- <file>
```

### Fix Last Commit Message
```bash
git commit --amend -m "new message"
```

### View Commit History
```bash
git log --oneline --graph -10
git show <commit-hash>
```

## Branch Naming

- `feat/description` - New features
- `fix/description` - Bug fixes
- `hotfix/description` - Urgent production fixes
- `docs/description` - Documentation
- `refactor/description` - Refactoring
- `test/description` - Test additions

## Best Practices

1. **Commit Often**: Small, focused commits
2. **Pull Before Push**: Always fetch latest changes
3. **Review Diffs**: Check `git diff` before committing
4. **Test Locally**: Run tests before pushing
5. **Use Branches**: Never commit directly to main
6. **Write Tests**: Include tests with feature commits

## Common Scenarios

### Merge Conflicts
```bash
git fetch origin
git rebase origin/main
# Edit conflicted files
git add <resolved-files>
git rebase --continue
```

### Stash Changes
```bash
git stash                    # Save work
git stash pop               # Restore work
git stash list              # List stashes
```

### Cherry Pick
```bash
git cherry-pick <commit>    # Apply specific commit
```
