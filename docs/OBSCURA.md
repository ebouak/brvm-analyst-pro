# Obscura Integration Guide

## Overview

Obscura is a headless Chromium CDP (Chrome DevTools Protocol) server used by BRVM Analyst Pro scraper to authenticate against BDFIN (ASP.NET WebForms) and scrape real market data.

**Why Obscura?**
- BDFIN login requires JavaScript execution (ASP.NET VIEWSTATE, dynamic form handling)
- Pure HTTP/axios cannot handle these complexities reliably
- Puppeteer over CDP provides full browser simulation without rendering overhead
- Stealth mode bypasses anti-bot detection

## Installation

1. **Install Obscura globally** (or run from npx):

```bash
npm install -g obscura
# or use via npx:
npx obscura serve --port 9222 --stealth
```

2. **Verify installation:**

```bash
obscura --version
```

## Local Development Setup

1. **Start Obscura** in a terminal:

```bash
npm run obscura:start
# or directly:
obscura serve --port 9222 --stealth
```

Expected output:
```
CDP server listening on ws://localhost:9222
Stealth mode enabled
```

2. **Configure environment:**

In `scraper/.env.local`:

```
OBSCURA_CDP_URL=ws://localhost:9222
BDFIN_USERNAME=<real BDFIN username>
BDFIN_PASSWORD=<real BDFIN password>
BDFIN_BASE_URL=https://bdfin.brvm.org
BDFIN_LOGIN_PATH=/login.aspx
BDFIN_MARKET_PATH=/ActivityMarket.aspx
```

3. **Test headless auth** (when integrated into scraper):

Headless authentication will be integrated into the BDFIN instruments and market scrapers in Task 2.

For manual testing during development, you can use:

```typescript
import { loginViaHeadless } from './src/client/bdfinAuthHeadless.js';
import { ObscuraBrowser } from './src/headless/obscura.js';

const config = { cdpUrl: 'ws://localhost:9222', stealth: true };
const browser = new ObscuraBrowser(config);
await browser.connect();

const result = await loginViaHeadless(
  browser,
  process.env.BDFIN_BASE_URL,
  process.env.BDFIN_LOGIN_PATH,
  process.env.BDFIN_USERNAME,
  process.env.BDFIN_PASSWORD,
);

console.log('Auth result:', result.success ? 'Success' : 'Failed');
await browser.close();
```

## Field Selector Calibration

If BDFIN login form structure changes, update selectors in `src/client/bdfinAuthHeadless.ts`:

```typescript
const LOGIN_SELECTORS = {
  usernameField: 'input[id*="UserName"]',      // ASP.NET control naming
  passwordField: 'input[id*="Password"]',
  submitButton: 'input[id*="LoginButton"]',    // May be <button> instead
  loginForm: 'form[id*="aspnetForm"]',
  loginPageIndicator: 'input[id*="Login"]',
};
```

### How to find correct selectors

1. Start Obscura: `npm run obscura:start`
2. Open browser DevTools to `ws://localhost:9222` (via [Chrome Remote Debugging](https://chromedevtools.github.io/devtools-protocol/))
3. Navigate to login page manually
4. Inspect HTML in DevTools
5. Copy actual `id` attributes
6. Update `LOGIN_SELECTORS` and test

## Troubleshooting

### "Connection refused" at ws://localhost:9222

**Cause:** Obscura not running

**Fix:**
```bash
npm run obscura:start
# Wait 2-3 seconds for server startup
```

### Login fails with "Timeout waiting for selector"

**Cause:** Form field selectors don't match actual markup

**Fix:**
1. Check BDFIN login page HTML (open in regular Chrome)
2. Verify selectors match actual `id` attributes
3. Update `LOGIN_SELECTORS` in `bdfinAuthHeadless.ts`
4. Re-run your test script using the code example from the "Test headless auth" section above

### Login succeeds but no session data

**Cause:** BDFIN may block rapid requests or require additional form submission

**Fix:**
1. Add delay between form interactions: increase `delay` in `page.type(...)`
2. Verify `finalUrl` is not still on login page (check logs)
3. Test with real browser to confirm credentials work

### Cookies not persisted

**Cause:** BDFIN may expire sessions after page navigation

**Fix:**
- Ensure scrapers reuse same headless session during one run
- Don't create new ObscuraBrowser for each request — pool it

## Production Deployment

For CI/CD (GitHub Actions, Vercel Cron):

1. **Use pre-built Obscura container** (Docker):

```dockerfile
FROM mcr.microsoft.com/playwright/node:v22.0.0
RUN npm install -g obscura
ENTRYPOINT ["obscura", "serve", "--port", "9222", "--stealth"]
```

2. **Or use remote Obscura service:**

Set `OBSCURA_CDP_URL` to remote endpoint (e.g., BrowserStack, Browserless)

3. **Environment variables:**

```bash
OBSCURA_CDP_URL=wss://remote-cdp-endpoint.com/ws
BDFIN_USERNAME=${BDFIN_USERNAME}  # GitHub Secrets
BDFIN_PASSWORD=${BDFIN_PASSWORD}  # GitHub Secrets
```

## Performance Tuning

- **Timeout:** `loginViaHeadless(..., timeout: 30000)` — increase if network is slow
- **Stealth mode:** Keep enabled for BDFIN anti-bot compatibility
- **Page pool:** Reuse ObscuraBrowser instance for multiple scrapes (different pages)
- **Headless instance limits:** Max 5-10 concurrent pages per Obscura instance

## References

- [Obscura Documentation](https://github.com/puppeteer/obscura)
- [Puppeteer API](https://pptr.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
