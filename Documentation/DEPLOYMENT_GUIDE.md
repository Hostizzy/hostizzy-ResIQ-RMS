# ResIQ Deployment Guide

This guide covers deploying ResIQ to staging and production environments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Rollback Strategy](#rollback-strategy)
8. [Monitoring & Logs](#monitoring--logs)

---

## Prerequisites

### Required Software
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Git**: Latest version
- **Vercel Account**: For deployment

### Required Accounts
- Supabase account (already configured)
- Vercel account with appropriate permissions
- GitHub repository access

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/Hostizzy/hostizzy-ResIQ-RMS.git
cd hostizzy-ResIQ-RMS
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

---

## Local Development

### Start Development Server

```bash
npm run dev
```

Server runs at: `http://localhost:3000`

### Run Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Coverage report
npm run test:coverage
```

### Build for Production

```bash
npm run build
```

Output: `dist/` folder

### Preview Production Build

```bash
npm run preview
```

---

## Staging Deployment

### Option 1: Automatic (Recommended)

Push to `develop` or `claude/*` branches:

```bash
git checkout develop
git pull origin develop
git merge your-feature-branch
git push origin develop
```

GitHub Actions will automatically:
1. Run type checks
2. Run unit tests
3. Build the application
4. Run E2E tests
5. Deploy to Vercel staging

### Option 2: Manual Deployment

```bash
# Build locally
npm run build

# Deploy to Vercel (staging)
npx vercel deploy

# Or with Vercel CLI installed globally
vercel deploy
```

### Staging URLs

- **Primary**: `https://resiq-staging.vercel.app`
- **Preview**: `https://resiq-<branch-name>.vercel.app`

---

## Production Deployment

### Prerequisites Checklist

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] No critical bugs in staging
- [ ] Database migrations completed (if any)
- [ ] Environment variables configured
- [ ] Rollback plan ready

### Deployment Steps

#### 1. Merge to Main Branch

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

#### 2. Automatic Deployment

GitHub Actions will:
1. Run all tests
2. Build production bundle
3. Deploy to Vercel production
4. Run post-deployment checks

#### 3. Manual Deployment (if needed)

```bash
# Build production bundle
npm run build

# Deploy to production
npx vercel --prod

# Or with CLI
vercel --prod
```

### Production URL

- **Primary**: `https://resiq.hostizzy.com`

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. **CI Pipeline** (`.github/workflows/ci.yml`)

Runs on every push to:
- `main`
- `develop`
- `claude/**` branches

**Jobs:**
1. TypeScript type checking
2. Unit tests with coverage
3. Build application
4. E2E tests
5. Deploy to staging (for develop/claude branches)
6. Deploy to production (for main branch only)

#### 2. **Preview Deployment** (`.github/workflows/preview.yml`)

Runs on pull requests:
- Builds and deploys preview
- Comments preview URL on PR

### Required GitHub Secrets

Set these in: **GitHub Repo → Settings → Secrets and variables → Actions**

```
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-org-id>
VERCEL_PROJECT_ID=<your-project-id>
```

### Getting Vercel Tokens

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Get tokens from .vercel/project.json
cat .vercel/project.json
```

---

## Vercel Configuration

### Vercel Dashboard Settings

1. **Framework Preset**: Vite
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm install`
5. **Node Version**: 18.x

### Environment Variables (Vercel)

Add in: **Vercel Dashboard → Settings → Environment Variables**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Set for:
- ✅ Production
- ✅ Preview
- ✅ Development

---

## Rollback Strategy

### Quick Rollback (Vercel)

#### Option 1: Vercel Dashboard

1. Go to Vercel Dashboard
2. Select project
3. Go to "Deployments"
4. Find previous successful deployment
5. Click "..." → "Promote to Production"

#### Option 2: Vercel CLI

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

#### Option 3: Git Revert

```bash
# Revert last commit
git revert HEAD

# Push to main (triggers auto-deploy)
git push origin main
```

### Post-Rollback Checklist

- [ ] Verify application is working
- [ ] Check database state
- [ ] Monitor error logs
- [ ] Notify team
- [ ] Document incident
- [ ] Plan hotfix

---

## Monitoring & Logs

### Vercel Logs

```bash
# View deployment logs
vercel logs <deployment-url>

# Follow logs in real-time
vercel logs --follow
```

### Application Monitoring

1. **Vercel Analytics**: Built-in performance monitoring
2. **Supabase Logs**: Database query monitoring
3. **Sentry** (optional): Error tracking
4. **LogRocket** (optional): Session replay

### Health Checks

**Automated Checks:**
- Uptime monitoring (every 5 minutes)
- Response time alerts (>3s)
- Error rate monitoring (>1%)

**Manual Checks:**
- Login functionality
- Create reservation
- Record payment
- View dashboard metrics
- PWA installation

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Code reviewed
- [ ] Type checking passes
- [ ] Build completes without errors
- [ ] Environment variables configured
- [ ] Database schema up to date
- [ ] Third-party integrations tested
- [ ] Rollback plan documented

### During Deployment

- [ ] Monitor GitHub Actions logs
- [ ] Watch Vercel deployment logs
- [ ] Check for build errors
- [ ] Verify deployment URL

### Post-Deployment

- [ ] Test login
- [ ] Test critical features
- [ ] Check PWA functionality
- [ ] Verify push notifications
- [ ] Monitor error logs (1 hour)
- [ ] Update documentation
- [ ] Notify stakeholders

---

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist .vercel
npm install
npm run build
```

### Deployment Fails

1. Check Vercel logs
2. Verify environment variables
3. Check build command
4. Verify output directory
5. Test build locally

### Environment Variables Not Working

```bash
# Verify variables in Vercel dashboard
# Make sure they're prefixed with VITE_
# Redeploy after adding variables
```

### Service Worker Issues

```bash
# Clear service worker cache
# In browser: DevTools → Application → Service Workers → Unregister
# Force reload: Ctrl/Cmd + Shift + R
```

---

## Performance Optimization

### Build Size Analysis

```bash
# Analyze bundle size
npm run build -- --mode production

# Check gzip sizes
ls -lh dist/assets/
```

### Optimization Tips

1. **Code Splitting**: Already configured in Vite
2. **Asset Optimization**: Images optimized
3. **Caching**: Configured in `vercel.json`
4. **PWA**: Service worker caching enabled
5. **Lazy Loading**: Import modules on demand

---

## Security Checklist

- [ ] HTTPS enabled (Vercel auto)
- [ ] Environment variables secured
- [ ] Supabase RLS policies active
- [ ] No secrets in code
- [ ] Dependencies updated
- [ ] Security headers configured
- [ ] CORS configured properly
- [ ] Input validation active

---

## Support

### Documentation
- [Vite Docs](https://vitejs.dev/)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)

### Internal Resources
- `/Documentation/MODERNIZATION_PLAN.md`
- `/Documentation/PHASE2_PROGRESS.md`
- `/README_BUILD.md`

### Contact
- **DevOps Team**: devops@hostizzy.com
- **On-Call**: +91-XXXX-XXXXXX

---

Last Updated: 2025-11-21
