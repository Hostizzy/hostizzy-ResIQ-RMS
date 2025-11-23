# Testing Guide: Validate Before Merging to Main

This guide shows you how to test everything thoroughly **without affecting the main branch**.

---

## ✅ Local Testing (No Git Required)

### Complete CI/CD Simulation

Run this single command to simulate the entire CI/CD pipeline locally:

```bash
# Run all checks in sequence
npm run typecheck && \
npm test -- --run && \
npm run build && \
echo "✅ All pipeline steps passed!"
```

**What this tests:**
1. ✅ TypeScript compilation (no type errors)
2. ✅ Unit tests (all 36 tests passing)
3. ✅ Production build (creates optimized bundle)

---

## 🔍 Individual Test Commands

### 1. Type Checking
```bash
npm run typecheck
```
**Validates:** TypeScript types are correct
**Expected:** No errors
**Time:** ~2 seconds

### 2. Unit Tests
```bash
npm test -- --run
```
**Validates:** All functionality works as expected
**Expected:** 36/36 tests passing
**Time:** ~3 seconds

### 3. Test Coverage
```bash
npm run test:coverage -- --run
```
**Validates:** Test coverage metrics
**Expected:** state.js: 100%, utils.js: 71%
**Time:** ~3 seconds

### 4. Production Build
```bash
npm run build
```
**Validates:** App builds successfully
**Expected:** dist/ folder created, 123KB gzipped
**Time:** ~400ms

### 5. Preview Build Locally
```bash
npm run build && npm run preview
```
**Validates:** Built app works in production mode
**Expected:** Server running at http://localhost:4173
**Time:** ~1 second

---

## 🌿 Git Branch Testing Strategy

### Current Safe Branch
```bash
# You're currently on this branch (safe to test)
git branch --show-current
# Output: claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV
```

This branch is **isolated from main** - you can:
- ✅ Make changes
- ✅ Commit freely
- ✅ Push to remote
- ✅ Test in CI/CD
- ❌ **Won't affect main** until you explicitly merge

### Testing Without Affecting Main

#### Option 1: Test on Current Branch (Recommended)
```bash
# Make changes and test
npm run typecheck
npm test
npm run build

# Commit if tests pass
git add .
git commit -m "test: validate changes"
git push origin claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV

# GitHub Actions will run automatically
# Check: https://github.com/Hostizzy/hostizzy-ResIQ-RMS/actions
```

#### Option 2: Create a Test Branch
```bash
# Create a new test branch from current
git checkout -b test/my-feature-test

# Make experimental changes
# ... edit files ...

# Test locally
npm run typecheck && npm test && npm run build

# Push to test in CI
git push origin test/my-feature-test

# If successful, merge back to your claude branch
git checkout claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV
git merge test/my-feature-test

# Delete test branch
git branch -D test/my-feature-test
```

#### Option 3: Use Git Stash for Quick Tests
```bash
# Save uncommitted changes
git stash

# Make test changes
# ... edit files ...

# Test
npm test

# Restore original changes
git stash pop
```

---

## 🚀 GitHub Actions CI/CD Testing

### View CI/CD Results Without Merging

1. **Push to Your Branch:**
   ```bash
   git push origin claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV
   ```

2. **Check GitHub Actions:**
   - Go to: https://github.com/Hostizzy/hostizzy-ResIQ-RMS/actions
   - Click on your latest workflow run
   - See all test results

3. **What Gets Tested in CI:**
   - ✅ TypeScript type checking
   - ✅ Unit tests (all 36 tests)
   - ✅ Production build
   - ✅ E2E tests (Playwright)
   - ✅ Auto-deploy to staging (optional)

### CI/CD Pipeline on Your Branch

```yaml
# Triggers on push to claude/** branches
Workflow: CI/CD Pipeline
├── Job 1: typecheck ✓
├── Job 2: test (unit tests) ✓
├── Job 3: build ✓
├── Job 4: e2e (if configured) ✓
└── Job 5: deploy-staging (if secrets set) ✓
```

**Note:** Main branch is **NOT affected** - CI runs independently on your branch.

---

## 📊 Verify Everything Is Working

### Checklist Before Merging to Main

Run through this checklist on your branch:

```bash
# 1. Clean install
rm -rf node_modules dist coverage
npm install

# 2. Type check
npm run typecheck
# Expected: No errors

# 3. Run all tests
npm test -- --run
# Expected: 36/36 tests passing

# 4. Build production bundle
npm run build
# Expected: dist/ created, 123KB gzipped

# 5. Check bundle size
ls -lh dist/index.html
# Expected: ~777KB raw, ~123KB gzipped

# 6. Preview locally (optional)
npm run preview
# Visit: http://localhost:4173
# Test: Login, create reservation, etc.

# 7. Check for vulnerabilities
npm audit
# Fix if needed: npm audit fix
```

---

## 🔒 Safe Merge to Main

### Only When Ready

**Prerequisites:**
- ✅ All local tests passing
- ✅ CI/CD passing on your branch
- ✅ Code reviewed (if working with team)
- ✅ Staging deployment tested (optional)

### Merge Process

```bash
# 1. Update your branch with latest main
git fetch origin main
git merge origin/main
# Resolve conflicts if any

# 2. Re-test after merge
npm run typecheck && npm test -- --run && npm run build

# 3. If all passes, merge to main
git checkout main
git merge claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV

# 4. Push to main (triggers production deployment)
git push origin main

# 5. Monitor deployment
# Check: https://github.com/Hostizzy/hostizzy-ResIQ-RMS/actions
```

---

## 🎯 Staging Environment Testing

### Deploy to Staging First (Recommended)

Instead of going straight to main, test in a staging environment:

```bash
# Option 1: Use your current branch
# Already deployed to: https://resiq-claude-continue-ux-analysis.vercel.app
# (After configuring Vercel secrets)

# Option 2: Use develop branch
git checkout develop
git merge claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV
git push origin develop
# Deploys to: https://resiq-develop.vercel.app

# Test thoroughly in staging:
# - Login/logout
# - Create reservation
# - Add payment
# - Test all features
# - Check PWA functionality
# - Test on mobile devices

# If staging works perfectly:
git checkout main
git merge develop
git push origin main
```

---

## 🛠️ Debugging Failed Tests

### If Tests Fail Locally

```bash
# Run tests in watch mode for debugging
npm test

# Run specific test file
npm test src/scripts/__tests__/utils.test.js

# Run with verbose output
npm test -- --reporter=verbose

# Check test coverage to find untested code
npm run test:coverage
```

### If Build Fails

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build

# Check for specific errors
npm run build 2>&1 | tee build.log

# Verify Vite config
cat vite.config.js
```

### If TypeScript Errors

```bash
# Run type check with details
npx tsc --noEmit --pretty

# Check specific file
npx tsc --noEmit src/scripts/utils.js

# Verify tsconfig
cat tsconfig.json
```

---

## 📈 Current Status

### ✅ All Tests Passing

```
TypeScript:  ✅ 0 errors
Unit Tests:  ✅ 36/36 passing (100%)
Coverage:    ✅ state.js: 100%, utils.js: 71%
Build:       ✅ 403ms, 123KB gzipped
Build Size:  ✅ 1.2MB total
E2E Setup:   ✅ Playwright v1.56.1
CI/CD:       ✅ Workflows configured
```

### Your Branch is Safe

```bash
# Current branch (safe)
claude/continue-ux-analysis-01AFCxEBBoffTUede2eXazFV

# Main branch (untouched)
main

# You can test freely on your branch!
```

---

## 🚦 Quick Reference

### Before Every Commit
```bash
npm run typecheck && npm test -- --run
```

### Before Pushing
```bash
npm run build && echo "✅ Ready to push!"
```

### Before Merging to Main
```bash
# Full validation
npm run typecheck && \
npm test -- --run && \
npm run test:coverage -- --run && \
npm run build && \
echo "✅ Safe to merge to main!"
```

---

## 🎓 Best Practices

### 1. **Test Locally First**
Always run tests locally before pushing to GitHub.

### 2. **Use Branch Protection**
Don't push directly to main. Always use feature branches.

### 3. **Run Full Test Suite**
Before merging to main, run all tests including coverage.

### 4. **Test in Staging**
Use a staging environment to test before production.

### 5. **Monitor CI/CD**
Check GitHub Actions results after every push.

### 6. **Small Commits**
Make small, focused commits that are easy to test and review.

---

## 📞 Getting Help

### Check Test Results
```bash
# Detailed test output
npm test -- --reporter=verbose

# Coverage report (HTML)
npm run test:coverage
open coverage/index.html
```

### Check CI/CD Logs
- GitHub Actions: https://github.com/Hostizzy/hostizzy-ResIQ-RMS/actions
- Click on failed workflow → View job details

### Verify Configuration
```bash
# Check all config files exist
ls -la tsconfig.json vitest.config.js playwright.config.js vercel.json

# Verify package.json scripts
cat package.json | grep -A 10 '"scripts"'
```

---

## ✅ Summary

**To test without affecting main:**

1. ✅ Run tests locally on your branch
2. ✅ Push to your branch (triggers CI/CD)
3. ✅ Check GitHub Actions results
4. ✅ Test in staging environment (optional)
5. ✅ Only merge to main when everything passes

**Your current branch is completely isolated from main - test freely!**

---

Last Updated: 2025-11-21
