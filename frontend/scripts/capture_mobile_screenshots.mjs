import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\lmspr\\.gemini\\antigravity\\brain\\4169d8c8-cbb6-4bad-a542-07db40ae4249\\screenshots\\mobile';
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'small-android-320', width: 320, height: 640 },
  { name: 'standard-mobile-360', width: 360, height: 740 },
  { name: 'android-mobile-375', width: 375, height: 667 },
  { name: 'android-mobile-390', width: 390, height: 844 },
  { name: 'large-mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 768 },
];

const USER_JSON = JSON.stringify({
  _id: '6af9e5e81afb351711b36fdd',
  name: 'Chief System Administrator',
  email: 'technova552026@gmail.com',
  role: 'ADMIN',
  status: 'APPROVED',
  permissions: { read: true, upload: true, download: true, manage: true },
});

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZjllNWU4MWFmYjM1MTcxMWIzNmZkZCIsImVtYWlsIjoidGVjaG5vdmE1NTIwMjZAZ21haWwuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzk0ODMwNTE0LCJleHAiOjE3OTU0MzUzMTR9.I_xfzpHPCPZPIQIGmGoWejGujFlgcuoCnd97eG4re-Q';

async function run() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // Helper to setup auth and theme in localStorage
  const setupPage = async (theme = 'dark') => {
    await page.evaluateOnNewDocument((u, t, th) => {
      localStorage.setItem('dms_user', u);
      localStorage.setItem('dms_token', t);
      localStorage.setItem('dms_theme', th);
    }, USER_JSON, TOKEN, theme);
  };

  await setupPage('dark');

  const inspectionResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });

    // 1. Dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // Check overflow
    const dashboardOverflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    // Check search bar metrics
    const searchMetrics = await page.evaluate(() => {
      const input = document.querySelector('header input[type="text"]');
      if (!input) return null;
      const rect = input.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        placeholder: input.placeholder,
        meetsTouchTarget: rect.height >= 40,
      };
    });

    const dashShot = path.join(SCREENSHOT_DIR, `dashboard-${vp.name}.png`);
    await page.screenshot({ path: dashShot, fullPage: false });
    console.log(`Saved dashboard: ${dashShot} (overflow: ${dashboardOverflow.hasHorizontalOverflow})`);

    // 2. Search dropdown active
    try {
      const searchInput = await page.$('header input[type="text"]');
      if (searchInput) {
        await searchInput.click();
        await searchInput.type('840D', { delay: 50 });
        await new Promise((r) => setTimeout(r, 1200));

        const searchDropdownMetrics = await page.evaluate(() => {
          const dropdown = document.querySelector('header .fixed.z-50, header .absolute.z-50');
          if (!dropdown) return null;
          const rect = dropdown.getBoundingClientRect();
          return {
            width: rect.width,
            left: rect.left,
            right: window.innerWidth - rect.right,
            isWithinBounds: rect.left >= 0 && rect.right <= window.innerWidth,
          };
        });

        const searchShot = path.join(SCREENSHOT_DIR, `search-active-${vp.name}.png`);
        await page.screenshot({ path: searchShot, fullPage: false });
        console.log(`Saved search active: ${searchShot} (dropdown bounds ok: ${searchDropdownMetrics?.isWithinBounds})`);
      }
    } catch (e) {
      console.warn('Search dropdown capture note:', e.message);
    }

    // 3. Document Library (DOConCD Table / Cards)
    await page.goto(`${BASE_URL}/library`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const libraryOverflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    const libShot = path.join(SCREENSHOT_DIR, `library-${vp.name}.png`);
    await page.screenshot({ path: libShot, fullPage: false });
    console.log(`Saved library: ${libShot} (overflow: ${libraryOverflow.hasHorizontalOverflow})`);

    // 4. Admin Users
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    const usersOverflow = await page.evaluate(() => {
      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    const usersShot = path.join(SCREENSHOT_DIR, `admin-users-${vp.name}.png`);
    await page.screenshot({ path: usersShot, fullPage: false });
    console.log(`Saved admin users: ${usersShot}`);

    // 5. Admin Requests
    await page.goto(`${BASE_URL}/admin/requests`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));

    const reqShot = path.join(SCREENSHOT_DIR, `admin-requests-${vp.name}.png`);
    await page.screenshot({ path: reqShot, fullPage: false });
    console.log(`Saved admin requests: ${reqShot}`);

    // 6. Admin Migration
    await page.goto(`${BASE_URL}/admin/migration`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const migShot = path.join(SCREENSHOT_DIR, `admin-migration-${vp.name}.png`);
    await page.screenshot({ path: migShot, fullPage: false });
    console.log(`Saved admin migration: ${migShot}`);

    inspectionResults.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      dashboardOverflow: dashboardOverflow.hasHorizontalOverflow,
      searchWidth: searchMetrics?.width,
      searchHeight: searchMetrics?.height,
      searchPlaceholder: searchMetrics?.placeholder,
      libraryOverflow: libraryOverflow.hasHorizontalOverflow,
      usersOverflow: usersOverflow.hasHorizontalOverflow,
    });
  }

  // Also capture Login page at 375px
  console.log('\n--- Capturing Login Page ---');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  const loginShot = path.join(SCREENSHOT_DIR, 'login-mobile-375.png');
  await page.screenshot({ path: loginShot, fullPage: false });
  console.log(`Saved login: ${loginShot}`);

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'inspection_summary.json'),
    JSON.stringify(inspectionResults, null, 2)
  );
  console.log('\nInspection summary written to inspection_summary.json');

  await browser.close();
}

run().catch((e) => {
  console.error('Inspection script error:', e);
  process.exit(1);
});
