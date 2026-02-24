# DNS Setup Guide for remtullahmedicallaboratory.co.tz

This guide will help you configure your custom domain to point to your deployed application and fix any redirect issues to old websites.

## Prerequisites

- Access to your domain registrar account (where you purchased remtullahmedicallaboratory.co.tz)
- Your application deployed on a hosting platform (Vercel, Netlify, or Cloudflare Pages)
- Admin access to your hosting platform account

---

## Step 1: Deploy Your Application

### Option A: Deploy to Netlify (Recommended)

1. **Create a Netlify account** at https://app.netlify.com/signup
2. **Connect your Git repository** or drag and drop your `dist` folder
3. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - The `netlify.toml` file in your project will be automatically detected
4. **Deploy the site** and note your Netlify URL (e.g., `your-site-name.netlify.app`)

### Option B: Deploy to Vercel

1. **Create a Vercel account** at https://vercel.com/signup
2. **Import your Git repository** or use Vercel CLI
3. **Configure project:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - The `vercel.json` file will be automatically detected
4. **Deploy** and note your Vercel URL (e.g., `your-project.vercel.app`)

### Option C: Deploy to Cloudflare Pages

1. **Create a Cloudflare account** at https://dash.cloudflare.com/sign-up
2. **Go to Pages** in the dashboard
3. **Create a new project** and connect your Git repository
4. **Configure build settings:**
   - Build command: `npm run build`
   - Build output directory: `dist`
5. **Deploy** and note your Cloudflare Pages URL

---

## Step 2: Fix Old Website Redirect Issue

Before setting up new DNS records, you need to remove old configurations:

### Check Current DNS Records

1. **Use a DNS lookup tool** to see where your domain currently points:
   - Visit https://www.whatsmydns.net/
   - Enter `remtullahmedicallaboratory.co.tz`
   - Check the A records and CNAME records

2. **Identify the old server:**
   - Note down the IP addresses or domains your DNS is pointing to
   - This is likely causing the redirect to the old website

### Remove Old Hosting Configuration

1. **Log into your old hosting provider** (if you know where the old site was hosted)
2. **Remove the domain** from the old hosting account or disable the old site
3. **Contact old hosting support** if needed to confirm the domain has been released

### Clear DNS Cache

After removing old configurations:
- Wait 5-10 minutes
- Clear your browser cache (Ctrl+Shift+Delete / Cmd+Shift+Delete)
- Flush your local DNS cache:
  - **Windows:** Open Command Prompt and run `ipconfig /flushdns`
  - **Mac:** Open Terminal and run `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
  - **Linux:** Run `sudo systemd-resolve --flush-caches`

---

## Step 3: Configure DNS Records at Your Domain Registrar

### Log into Your Domain Registrar

Access your account where you purchased the `.co.tz` domain. Common registrars for Tanzania domains include:
- Tanzania Network Information Centre (tzNIC)
- Local registrars (WebAfrica, AfriRegister, etc.)
- International registrars that support .tz domains

### Delete Old DNS Records

**IMPORTANT:** Remove any existing records that point to old servers:

1. Find and **delete all existing A records** for:
   - `@` (apex domain)
   - `remtullahmedicallaboratory.co.tz`
2. Find and **delete all existing CNAME records** for:
   - `www`
   - `www.remtullahmedicallaboratory.co.tz`

### Add New DNS Records

Choose the configuration based on your hosting provider:

#### For Netlify:

**Step 1: Add A Record for Apex Domain**
- Type: `A`
- Name: `@` or leave blank (represents remtullahmedicallaboratory.co.tz)
- Value/Points to: `75.2.60.5`
- TTL: `300` (5 minutes, for testing) or `3600` (1 hour)

**Step 2: Add CNAME Record for www**
- Type: `CNAME`
- Name: `www`
- Value/Points to: `your-site-name.netlify.app`
- TTL: `300` or `3600`

#### For Vercel:

**Step 1: Add A Record for Apex Domain**
- Type: `A`
- Name: `@` or leave blank
- Value/Points to: `76.76.21.21`
- TTL: `300` or `3600`

**Step 2: Add CNAME Record for www**
- Type: `CNAME`
- Name: `www`
- Value/Points to: `cname.vercel-dns.com`
- TTL: `300` or `3600`

#### For Cloudflare Pages:

If using Cloudflare Pages, it's recommended to also use Cloudflare for DNS:

**Step 1: Add Cloudflare as Nameservers**
- In your domain registrar, change nameservers to Cloudflare's
- Follow Cloudflare's setup wizard

**Step 2: In Cloudflare DNS settings:**
- Type: `A`
- Name: `@`
- Value: `192.0.2.1` (Cloudflare placeholder)
- Proxy status: Proxied (orange cloud)
- TTL: Auto

- Type: `CNAME`
- Name: `www`
- Value: `remtullahmedicallaboratory.co.tz`
- Proxy status: Proxied (orange cloud)
- TTL: Auto

### Save DNS Changes

1. **Save all changes** in your domain registrar's DNS management panel
2. **Verify settings** before closing the panel
3. **Note the time** you made changes for tracking propagation

---

## Step 4: Add Custom Domain to Hosting Platform

### For Netlify:

1. Go to **Site Settings → Domain Management**
2. Click **Add custom domain**
3. Enter `remtullahmedicallaboratory.co.tz`
4. Click **Verify** and **Add domain**
5. Add `www.remtullahmedicallaboratory.co.tz` as an additional domain
6. Netlify will automatically provision an SSL certificate (this may take a few minutes)
7. Under **HTTPS**, enable **Force HTTPS** (redirect HTTP to HTTPS)
8. Set up **Domain redirect** to redirect www to non-www (or vice versa)

### For Vercel:

1. Go to **Project Settings → Domains**
2. Enter `remtullahmedicallaboratory.co.tz` and click **Add**
3. Vercel will verify the DNS configuration
4. Add `www.remtullahmedicallaboratory.co.tz` as well
5. Wait for SSL certificate to be provisioned automatically
6. Set one domain as primary (for redirects)

### For Cloudflare Pages:

1. Go to **Pages → Your Project → Custom domains**
2. Click **Set up a custom domain**
3. Enter `remtullahmedicallaboratory.co.tz`
4. Cloudflare will automatically configure and verify
5. SSL certificate is automatic with Cloudflare
6. Add `www.remtullahmedicallaboratory.co.tz` if desired

---

## Step 5: Verify DNS Propagation

DNS changes can take anywhere from 5 minutes to 48 hours to fully propagate globally.

### Check DNS Propagation Status

1. **Use online tools:**
   - https://www.whatsmydns.net/
   - Enter your domain: `remtullahmedicallaboratory.co.tz`
   - Check if different global DNS servers show your new IP/CNAME

2. **Check from command line:**
   ```bash
   # Check A record
   dig remtullahmedicallaboratory.co.tz

   # Check CNAME record
   dig www.remtullahmedicallaboratory.co.tz

   # Or use nslookup
   nslookup remtullahmedicallaboratory.co.tz
   ```

### Test Your Domain

1. **Clear your browser cache** completely
2. **Use incognito/private mode** to test without cached data
3. **Visit your domain:**
   - https://remtullahmedicallaboratory.co.tz
   - https://www.remtullahmedicallaboratory.co.tz
4. **Verify SSL certificate** (look for padlock icon in browser)
5. **Test all routes** in your application

---

## Step 6: Troubleshooting Common Issues

### Issue: Domain still redirects to old website

**Solutions:**
1. Double-check you removed ALL old DNS records
2. Clear your local DNS cache (see Step 2)
3. Try accessing from a different device or network
4. Use a VPN to test from a different location
5. Contact your old hosting provider to confirm domain release
6. Wait longer - full DNS propagation can take 24-48 hours

### Issue: SSL Certificate not working

**Solutions:**
1. Wait 10-20 minutes after adding domain (auto-provisioning takes time)
2. Verify DNS records are correctly pointing to hosting provider
3. In hosting platform, try removing and re-adding the domain
4. Check if hosting platform shows SSL certificate as "Active" or "Pending"

### Issue: "DNS_PROBE_FINISHED_NXDOMAIN" error

**Solutions:**
1. DNS records not yet propagated - wait longer
2. Verify DNS records are correctly entered (no typos)
3. Ensure TTL values are set (try 300 seconds for testing)
4. Check that domain hasn't expired at registrar

### Issue: Works on www but not apex domain (or vice versa)

**Solutions:**
1. Verify both A record (@) and CNAME record (www) are configured
2. Check hosting platform has both domains added
3. Set up proper redirect rules (www → non-www or vice versa)

### Issue: "This site can't be reached" error

**Solutions:**
1. Verify application is deployed and running on hosting platform
2. Check hosting platform doesn't show any deployment errors
3. Verify environment variables (especially Supabase URLs) are set in hosting platform
4. Check hosting platform logs for errors

---

## Step 7: Final Configuration

### Set Environment Variables on Hosting Platform

Make sure these environment variables are set in your hosting platform:

- `VITE_SUPABASE_URL` = Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = Your Supabase anonymous key

### Configure Supabase CORS

In your Supabase project dashboard:
1. Go to **Authentication → URL Configuration**
2. Add your custom domain to **Site URL**:
   - `https://remtullahmedicallaboratory.co.tz`
3. Add to **Redirect URLs**:
   - `https://remtullahmedicallaboratory.co.tz/**`
   - `https://www.remtullahmedicallaboratory.co.tz/**`

### Set Up Monitoring

1. **Google Search Console:**
   - Add and verify your domain
   - Submit sitemap for better SEO

2. **Uptime Monitoring:**
   - Use services like UptimeRobot or Pingdom
   - Get alerts if your site goes down

3. **Analytics:**
   - Set up Google Analytics or similar
   - Track visitor data and performance

---

## Quick Reference: DNS Record Values

| Hosting Provider | Record Type | Name | Value |
|-----------------|-------------|------|-------|
| **Netlify** | A | @ | 75.2.60.5 |
| **Netlify** | CNAME | www | your-site.netlify.app |
| **Vercel** | A | @ | 76.76.21.21 |
| **Vercel** | CNAME | www | cname.vercel-dns.com |
| **Cloudflare** | A | @ | 192.0.2.1 (proxied) |
| **Cloudflare** | CNAME | www | @ (proxied) |

---

## Support Resources

- **Netlify DNS Setup:** https://docs.netlify.com/domains-https/custom-domains/
- **Vercel Custom Domains:** https://vercel.com/docs/concepts/projects/domains
- **Cloudflare Pages:** https://developers.cloudflare.com/pages/get-started/
- **DNS Propagation Checker:** https://www.whatsmydns.net/
- **SSL Certificate Checker:** https://www.sslshopper.com/ssl-checker.html

---

## Timeline Expectations

- **DNS Record Changes:** 5 minutes to 48 hours for full global propagation
- **SSL Certificate Provisioning:** 5-20 minutes after DNS is verified
- **Typical Full Setup Time:** 1-6 hours (including DNS propagation)

Remember: DNS propagation times vary by registrar and geographic location. Be patient and use the verification tools to track progress.
