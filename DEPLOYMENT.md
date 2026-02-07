# Deployment Guide for Nexus Planner

This guide covers deploying Nexus Planner to various hosting platforms.

## 🚀 Quick Deploy Options

### Option 1: Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Build Settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Add Environment Variables**
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)
   - Your app will be live at `your-project.vercel.app`

### Option 2: Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. **Connect Repository**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository

2. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18 or higher

3. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add:
     ```
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Deploy**
   - Click "Deploy site"
   - Your app will be live at `your-site.netlify.app`

### Option 3: Cloudflare Pages

1. **Connect Repository**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com)
   - Click "Create a project"
   - Connect your GitHub repository

2. **Configure Build**
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`

3. **Environment Variables**
   - Add in Settings → Environment variables:
     ```
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Deploy**
   - Click "Save and Deploy"

## 🔧 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Supabase project is set up and configured
- [ ] Database schema is applied
- [ ] Environment variables are ready
- [ ] `.env` file is NOT committed to git
- [ ] Build succeeds locally (`npm run build`)
- [ ] Preview works locally (`npm run preview`)
- [ ] All tests pass (`npm test`)

## 🌐 Custom Domain Setup

### Vercel

1. Go to your project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Wait for SSL certificate (automatic)

### Netlify

1. Go to Site settings → Domain management
2. Click "Add custom domain"
3. Follow DNS configuration instructions
4. SSL is automatic

### Cloudflare Pages

1. Go to Custom domains
2. Add your domain
3. Configure DNS (usually automatic if using Cloudflare DNS)

## 🔐 Security Configuration

### Update Supabase Settings

After deployment, update your Supabase project:

1. Go to Supabase → Authentication → URL Configuration
2. Add your production URL to:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/**`

### CORS Configuration

If you encounter CORS issues:

1. Go to Supabase → Settings → API
2. Add your domain to allowed origins
3. Redeploy your app

### Environment Variables

**Never expose these in client code:**
- ✅ Use `VITE_` prefix for client-side variables
- ❌ Don't commit `.env` to git
- ✅ Use platform environment variables

## 📊 Monitoring and Analytics

### Vercel Analytics

1. Enable in project settings
2. Add to your app:
   ```bash
   npm install @vercel/analytics
   ```
3. Update `main.tsx`:
   ```typescript
   import { Analytics } from '@vercel/analytics/react';
   
   // Add to your app
   <Analytics />
   ```

### Error Tracking (Sentry)

1. Create account at [sentry.io](https://sentry.io)
2. Install:
   ```bash
   npm install @sentry/react
   ```
3. Configure in `main.tsx`:
   ```typescript
   import * as Sentry from "@sentry/react";
   
   Sentry.init({
     dsn: "your-sentry-dsn",
     environment: import.meta.env.MODE,
   });
   ```

## 🚦 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 🔄 Continuous Deployment

### Auto-deploy on Git Push

Most platforms support automatic deployment:

**Vercel**: Automatically deploys on push to main branch
**Netlify**: Automatically deploys on push to main branch
**Cloudflare Pages**: Automatically deploys on push

### Preview Deployments

All platforms create preview deployments for pull requests:
- Each PR gets a unique URL
- Perfect for testing before merging
- Automatically cleaned up after merge

## 📈 Performance Optimization

### Build Optimization

1. **Code Splitting**
   - Already configured with Vite
   - Lazy load routes if needed

2. **Asset Optimization**
   - Images: Use WebP format
   - Compress images before upload
   - Use CDN for static assets

3. **Bundle Analysis**
   ```bash
   npm run build -- --mode analyze
   ```

### Caching Strategy

Configure in `vercel.json` or `netlify.toml`:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🐛 Troubleshooting

### Build Fails

**Problem**: Build fails with module not found

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment Variables Not Working

**Problem**: Supabase connection fails in production

**Solution**:
1. Verify environment variables are set in platform
2. Ensure they start with `VITE_`
3. Redeploy after adding variables

### 404 on Page Refresh

**Problem**: Direct URL access returns 404

**Solution**: Configure SPA routing

**Vercel** (`vercel.json`):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Netlify** (`netlify.toml`):
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 📱 Progressive Web App (PWA)

To enable PWA features:

1. Install plugin:
   ```bash
   npm install vite-plugin-pwa -D
   ```

2. Update `vite.config.ts`:
   ```typescript
   import { VitePWA } from 'vite-plugin-pwa'
   
   export default defineConfig({
     plugins: [
       react(),
       VitePWA({
         registerType: 'autoUpdate',
         manifest: {
           name: 'Nexus Planner',
           short_name: 'Nexus',
           description: 'Project Management Platform',
           theme_color: '#5B5FEF',
         }
       })
     ]
   })
   ```

## 🌍 Multi-Region Deployment

For global users, consider:

1. **Vercel Edge Network**: Automatic global CDN
2. **Cloudflare**: Built-in global network
3. **Supabase**: Choose closest region for database

## 📊 Post-Deployment

After successful deployment:

1. ✅ Test all features in production
2. ✅ Verify authentication works
3. ✅ Check database connections
4. ✅ Test file uploads
5. ✅ Monitor error logs
6. ✅ Set up analytics
7. ✅ Configure backups

## 🔄 Rollback Strategy

If deployment fails:

**Vercel**: 
- Go to Deployments
- Click on previous successful deployment
- Click "Promote to Production"

**Netlify**:
- Go to Deploys
- Find previous deploy
- Click "Publish deploy"

## 📞 Support

If you encounter issues:

1. Check platform status pages
2. Review deployment logs
3. Check Supabase logs
4. Open an issue in repository

---

**Congratulations!** Your Nexus Planner is now live! 🎉
