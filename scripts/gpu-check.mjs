import { chromium, launchOptions } from "./browser.mjs";
const browser = await chromium.launch({
  ...launchOptions,
  headless: false,
  args: [
    "--no-sandbox",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=gl",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:5173");
await page.waitForFunction(() => window.__evergreen?.world);
await page.waitForTimeout(4000);
console.log(
  "first",
  await page.evaluate(() => ({
    visibility: document.visibilityState,
    metrics: window.__evergreen.world.metrics(),
  })),
);
await page.waitForTimeout(4000);
console.log(
  "second",
  await page.evaluate(() => window.__evergreen.world.metrics()),
);
await browser.close();
