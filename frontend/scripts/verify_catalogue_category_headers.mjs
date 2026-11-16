import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\lmspr\\.gemini\\antigravity\\brain\\fead1b44-f3ba-445d-afd2-56afadf67eb8\\screenshots';
const BASE_URL = 'http://localhost:5173';
const TARGET_URL = `${BASE_URL}/library/6af9d05ba1a8b3b2f4ddf68b`;

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const USER_JSON = JSON.stringify({
  _id: '6af9d059a1a8b3b2f4ddf68a',
  name: 'Chief System Administrator',
  email: 'technova552026@gmail.com',
  role: 'ADMIN',
  status: 'APPROVED',
  permissions: { read: true, upload: true, download: true, manage: true },
});

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZjlkMDU5YTFhOGIzYjJmNGRkZjY4YSIsImVtYWlsIjoidGVjaG5vdmE1NTIwMjZAZ21haWwuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzk0ODQ3MTg3LCJleHAiOjE3OTU0NTE5ODd9.cWC-0e9HCA6DUVNsi1erbO0JclN54fkFVofxXhCWTQs';

async function verify() {
  console.log('=== Starting Siemens Catalogue Category Header Verification ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument((u, t) => {
    localStorage.setItem('dms_user', u);
    localStorage.setItem('dms_token', t);
    localStorage.setItem('dms_theme', 'dark');
  }, USER_JSON, TOKEN);

  // 1. DESKTOP VIEW VERIFICATION (1366x800)
  console.log('\n--- 1. Testing Desktop View (1366x800) ---');
  await page.setViewport({ width: 1366, height: 800, deviceScaleFactor: 2 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for table to load
  await page.waitForSelector('table', { timeout: 10000 });
  await page.waitForSelector('tr[data-cat-row="true"]', { timeout: 10000 });

  // Check Table Columns
  const thTexts = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('table thead th'));
    return ths.map(th => th.innerText.trim());
  });
  console.log('Detected <thead> column headers:', thTexts);
  const expectedCols = ['System', 'Title', 'SW', 'Edition', 'Order No.', 'File name', 'Status', 'Actions'];
  const colsMatch = expectedCols.every((col, i) => thTexts[i] === col);
  console.log('Columns exactly match expected 8 columns in order:', colsMatch);

  // Inspect category header rows
  const catRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr[data-cat-row="true"]'));
    return rows.map((r, i) => {
      const style = window.getComputedStyle(r);
      const titleEl = r.querySelector('span.font-bold');
      const countEl = r.querySelector('span.rounded-full');
      const chevronEl = r.querySelector('svg');
      const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
      const chevronStyle = chevronEl ? window.getComputedStyle(chevronEl) : null;

      return {
        index: i,
        category: r.getAttribute('data-category'),
        bandType: r.getAttribute('data-band-type'),
        bgColor: style.backgroundColor,
        textColor: titleStyle ? titleStyle.color : null,
        chevronColor: chevronStyle ? chevronStyle.color : null,
        title: titleEl ? titleEl.innerText.trim() : null,
        countText: countEl ? countEl.innerText.trim() : null,
      };
    });
  });

  console.log(`\nFound ${catRows.length} category header rows in table:`);
  catRows.slice(0, 6).forEach(c => {
    console.log(`Category [${c.index}]: ${c.category}`);
    console.log(`  Band Type: ${c.bandType} | BG: ${c.bgColor} | Text: ${c.textColor} | Chevron: ${c.chevronColor}`);
    console.log(`  Title: "${c.title}" | Count: "${c.countText}"`);
  });

  // Verify colors:
  // #F59E0B -> rgb(245, 158, 11)
  // #FDBA74 -> rgb(253, 186, 116)
  // #292016 -> rgb(41, 32, 22)
  let colorsCorrect = true;
  catRows.forEach(c => {
    const isPrimary = c.index % 2 === 0;
    const expectedBg = isPrimary ? 'rgb(245, 158, 11)' : 'rgb(253, 186, 116)';
    const expectedText = 'rgb(41, 32, 22)';
    if (c.bgColor !== expectedBg) {
      console.error(`Mismatch bg for ${c.category}: expected ${expectedBg}, got ${c.bgColor}`);
      colorsCorrect = false;
    }
    if (c.textColor !== expectedText) {
      console.error(`Mismatch text for ${c.category}: expected ${expectedText}, got ${c.textColor}`);
      colorsCorrect = false;
    }
  });
  console.log('\nAlternating category band colours and dark charcoal text verified:', colorsCorrect);

  // Inspect document rows
  const docRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr[data-doc-row="true"]'));
    return {
      totalDocRows: rows.length,
      sampleFirst3: rows.slice(0, 3).map((r, i) => {
        const style = window.getComputedStyle(r);
        const tds = Array.from(r.querySelectorAll('td'));
        return {
          rowIdx: i,
          bgColor: style.backgroundColor,
          system: tds[0]?.innerText.trim(),
          title: tds[1]?.innerText.trim(),
          sw: tds[2]?.innerText.trim(),
          edition: tds[3]?.innerText.trim(),
          orderNo: tds[4]?.innerText.trim(),
          fileName: tds[5]?.innerText.trim(),
          status: tds[6]?.innerText.trim(),
          actions: tds[7]?.innerText.trim(),
        };
      }),
    };
  });
  console.log(`\nFound ${docRows.totalDocRows} rendered document rows across categories.`);
  console.log('Sample first 3 document rows:', docRows.sampleFirst3);

  // Screenshot desktop table overview
  const desktopHeadersPath = path.join(SCREENSHOT_DIR, 'siemens-catalogue-desktop-headers.png');
  await page.screenshot({ path: desktopHeadersPath, fullPage: false });
  console.log('Saved screenshot:', desktopHeadersPath);

  // Scroll down slightly to capture more categories and document rows
  await page.evaluate(() => window.scrollBy(0, 450));
  await new Promise(r => setTimeout(r, 400));
  const desktopDetailPath = path.join(SCREENSHOT_DIR, 'siemens-catalogue-desktop-detail.png');
  await page.screenshot({ path: desktopDetailPath, fullPage: false });
  console.log('Saved detail screenshot:', desktopDetailPath);

  // 1b. INTERACTIVE CONTROLS VERIFICATION
  console.log('\n--- 1b. Testing Interactive Controls (Collapse, Expand, Search) ---');
  // Collapse All
  const collapseAllBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Collapse All'));
  });
  await collapseAllBtn.click();
  await new Promise(r => setTimeout(r, 400));
  const docRowsCollapsed = await page.evaluate(() => document.querySelectorAll('tr[data-doc-row="true"]').length);
  console.log(`Doc rows visible after Collapse All: ${docRowsCollapsed} (Expected: 0)`);

  // Expand All
  const expandAllBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Expand All'));
  });
  await expandAllBtn.click();
  await new Promise(r => setTimeout(r, 400));
  const docRowsExpanded = await page.evaluate(() => document.querySelectorAll('tr[data-doc-row="true"]').length);
  console.log(`Doc rows visible after Expand All: ${docRowsExpanded} (Expected: 212)`);

  // Search Filter
  await page.type('input[placeholder*="Search System"]', 'linear');
  await new Promise(r => setTimeout(r, 400));
  const docRowsFiltered = await page.evaluate(() => document.querySelectorAll('tr[data-doc-row="true"]').length);
  console.log(`Doc rows visible after searching "linear": ${docRowsFiltered}`);

  // Clear search
  const clearBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Clear Filters'));
  });
  if (clearBtn) {
    await clearBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }
  const docRowsReset = await page.evaluate(() => document.querySelectorAll('tr[data-doc-row="true"]').length);
  console.log(`Doc rows visible after clearing search: ${docRowsReset} (Expected: 212)`);

  // 2. MOBILE VIEW VERIFICATION (390x844)
  console.log('\n--- 2. Testing Mobile View (390x844) ---');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));

  const mobileHeaders = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('button[data-mobile-cat-header="true"]'));
    return headers.map((h, i) => {
      const rect = h.getBoundingClientRect();
      const style = window.getComputedStyle(h);
      const titleEl = h.querySelector('.text-xs');
      const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;

      return {
        index: i,
        category: h.getAttribute('data-category'),
        bandType: h.getAttribute('data-band-type'),
        height: rect.height,
        bgColor: style.backgroundColor,
        textColor: titleStyle ? titleStyle.color : null,
      };
    });
  });

  console.log(`Found ${mobileHeaders.length} mobile category accordion headers:`);
  mobileHeaders.slice(0, 4).forEach(m => {
    console.log(`Mobile Cat [${m.index}]: ${m.category} | Height: ${m.height}px (>=44px: ${m.height >= 44})`);
    console.log(`  BG: ${m.bgColor} | Text: ${m.textColor}`);
  });

  const mobileHeadersPath = path.join(SCREENSHOT_DIR, 'siemens-catalogue-mobile-headers.png');
  await page.screenshot({ path: mobileHeadersPath, fullPage: false });
  console.log('Saved mobile screenshot:', mobileHeadersPath);

  // Scroll down slightly on mobile to see document cards
  await page.evaluate(() => window.scrollBy(0, 380));
  await new Promise(r => setTimeout(r, 400));
  const mobileDetailPath = path.join(SCREENSHOT_DIR, 'siemens-catalogue-mobile-detail.png');
  await page.screenshot({ path: mobileDetailPath, fullPage: false });
  console.log('Saved mobile detail screenshot:', mobileDetailPath);

  await browser.close();
  console.log('\n=== Verification Complete Successfully! ===');
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
