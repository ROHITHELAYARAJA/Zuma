const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('C:/Users/erohi/AppData/Local/npm-cache/_npx/5b41d52cc12ea726/node_modules/puppeteer-core');

const BASE = 'http://127.0.0.1:3000';
const OUT = 'C:/Users/erohi/OneDrive/Desktop/Zuma/outputs/zuma-ravi-demo/assets';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function visibleText(element) {
  return (await element.evaluate((node) => node.innerText || node.textContent || '')).trim();
}

async function clickUniqueButton(page, label) {
  const buttons = await page.$$('button');
  const matches = [];
  for (const button of buttons) if ((await visibleText(button)) === label) matches.push(button);
  if (matches.length !== 1) throw new Error(`Expected one visible button '${label}', found ${matches.length}`);
  await matches[0].click();
}

async function clickNavButton(page, label) {
  const nav = await page.$('nav[aria-label="Main navigation"]');
  if (!nav) throw new Error('Main navigation was not present.');
  const buttons = await nav.$$('button');
  const matches = [];
  for (const button of buttons) if ((await visibleText(button)) === label) matches.push(button);
  if (matches.length !== 1) throw new Error(`Expected one navigation button '${label}', found ${matches.length}`);
  await matches[0].click();
}

async function matchingCard(page, mrn) {
  const cards = await page.$$('article');
  const matches = [];
  for (const card of cards) if ((await visibleText(card)).includes(`MRN ${mrn}`)) matches.push(card);
  if (matches.length !== 1) throw new Error(`Expected one visible candidate card for ${mrn}, found ${matches.length}`);
  return matches[0];
}

async function clickCardButton(card, label) {
  const buttons = await card.$$('button');
  const matches = [];
  for (const button of buttons) if ((await visibleText(button)) === label) matches.push(button);
  if (matches.length !== 1) throw new Error(`Expected one '${label}' action in the chosen candidate card, found ${matches.length}`);
  await matches[0].click();
}

async function save(page, filename) {
  await page.waitForFunction(() => !document.querySelector('.toast'), { timeout: 7500 }).catch(() => {});
  await pause(250);
  await page.screenshot({ path: path.join(OUT, filename), type: 'png' });
}

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE,
    args: ['--no-sandbox', '--disable-gpu', '--disable-background-timer-throttling'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.2 });
    const response = await page.goto(`${BASE}/workspace/compare`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response || response.status() !== 200) throw new Error(`Local demo returned HTTP ${response?.status() ?? 'no response'}`);
    await page.waitForSelector('nav[aria-label="Main navigation"] button', { timeout: 30000 });
    await pause(900);
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});

    await clickNavButton(page, 'Patient matching');
    await page.waitForFunction(() => document.body.innerText.includes('Cross-hospital candidates'), { timeout: 30000 });
    let cardA = await matchingCard(page, 'B-507');
    let textA = await visibleText(cardA);
    if (/review required/i.test(textA)) {
      await clickCardButton(cardA, 'Confirm link');
      await page.waitForFunction(() => {
        const card = [...document.querySelectorAll('article')].find((node) => node.innerText.includes('MRN B-507'));
        return !!card && /confirmed/i.test(card.innerText);
      }, { timeout: 30000 });
    } else if (!/confirmed/i.test(textA)) throw new Error('B-507 was neither review-required nor confirmed.');

    let cardB = await matchingCard(page, 'B-811');
    let textB = await visibleText(cardB);
    if (/review required/i.test(textB)) {
      await clickCardButton(cardB, 'Different patient');
      await page.waitForFunction(() => {
        const card = [...document.querySelectorAll('article')].find((node) => node.innerText.includes('MRN B-811'));
        return !!card && /not a match/i.test(card.innerText);
      }, { timeout: 30000 });
    } else if (!/not a match/i.test(textB)) throw new Error('B-811 was neither review-required nor already marked different.');
    await save(page, '01-identity-review-1920x1080.png');

    await clickNavButton(page, 'Consent center');
    await page.waitForFunction(() => document.body.innerText.includes('Consent center') && document.body.innerText.includes('Access for Ravi Kumar'), { timeout: 30000 });
    let body = await page.$eval('body', (node) => node.innerText);
    if (/Access revoked or expired|Cross-hospital consent was revoked/i.test(body)) {
      await clickUniqueButton(page, 'Grant demo permission');
      await page.waitForFunction(() => document.body.innerText.includes('Active permission') && document.body.innerText.includes('Treatment access permitted'), { timeout: 30000 });
      body = await page.$eval('body', (node) => node.innerText);
    }
    if (!body.includes('Active permission') || !body.includes('Expires')) throw new Error('The 24-hour synthetic permission was not visibly active.');
    await save(page, '02-consent-24h-1920x1080.png');

    await clickNavButton(page, 'Workspace');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('Penicillin allergy documented') && text.includes('No known allergies recorded') && text.includes('Metformin 500 mg');
    }, { timeout: 30000 });
    await pause(400);
    const workspaceText = await page.$eval('body', (node) => node.innerText);
    if (/Hospital A evidence is withheld|Identity \/ permission required/.test(workspaceText)) throw new Error('Cross-hospital evidence remained withheld after permission was granted.');
    await save(page, '03-source-comparison-1920x1080.png');

    const summaryButton = await page.$('button[aria-label="Regenerate summary"]') || await page.$('button[aria-label="Generate summary"]');
    if (summaryButton) {
      await summaryButton.click();
      await page.waitForFunction(() => /Drafted on/.test(document.body.innerText) && document.body.innerText.includes('Evidence draft'), { timeout: 30000 });
    }
    const summary = await page.$('.summary-panel');
    if (!summary) throw new Error('Source-linked clinical summary panel was not rendered.');
    await summary.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForFunction(() => {
      const el = document.querySelector('.summary-panel');
      return !!el && Math.abs(el.getBoundingClientRect().top) < 300;
    }, { timeout: 5000 });
    await save(page, '04-source-linked-summary-1920x1080.png');

    const timeline = await page.$('.timeline-panel');
    if (!timeline) throw new Error('Evidence timeline panel was not rendered.');
    await timeline.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForFunction(() => {
      const el = document.querySelector('.timeline-panel');
      return !!el && Math.abs(el.getBoundingClientRect().top) < 300;
    }, { timeout: 5000 });
    await save(page, '05-evidence-timeline-1920x1080.png');

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await pause(500);
    await clickUniqueButton(page, 'Review & export');
    await page.waitForFunction(() => /Review|Export|Approve/i.test(document.body.innerText), { timeout: 30000 });
    await save(page, '06-clinician-review-1920x1080.png');

    console.log(JSON.stringify({
      ok: true,
      viewport: page.viewport(),
      screenshotPixels: '1920x1080',
      captures: [
        '01-identity-review-1920x1080.png',
        '02-consent-24h-1920x1080.png',
        '03-source-comparison-1920x1080.png',
        '04-source-linked-summary-1920x1080.png',
        '05-evidence-timeline-1920x1080.png',
        '06-clinician-review-1920x1080.png',
      ],
      identity: 'B-507 confirmed from synthetic DOB/contact-token match; B-811 kept separate due differing DOB/contact token.',
      consent: 'synthetic treatment consent active for 24 hours; category selections retained from the local consent screen.',
      answerPath: 'No cross-hospital chat/Bedrock query was sent; local mock configuration requires AWS knowledge-base retrieval for that chat route.',
      approval: 'Review screen opened for capture only; no summary approval or export action submitted.',
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
