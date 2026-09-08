import { chromium, launchOptions } from "./browser.mjs";
import { rename } from "node:fs/promises";

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: "artifacts/video", size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
await page.goto("http://localhost:5173");
await page.waitForFunction(() => document.body.dataset.view === "immersive");
await page.waitForTimeout(800);
await page.getByRole("link", { name: "Explore our world" }).click();
await page.waitForTimeout(1300);
await page.evaluate(async () => {
  const stops = window.__evergreen.stops;
  const move = (from, to, duration) =>
    new Promise((resolve) => {
      const start = performance.now();
      function frame(time) {
        const t = Math.min(1, (time - start) / duration);
        scrollTo(0, from + (to - from) * t);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  for (let i = 1; i < stops.length - 1; i++) {
    await move(stops[i].start, stops[i].end, 700);
    await move(stops[i].end, stops[i + 1].start, 1700);
  }
  await move(stops[7].start, stops[7].end, 1000);
  await move(scrollY, stops[4].start, 3600);
});
await page.screenshot({ path: "artifacts/journey-motion-end.png" });
const video = page.video();
await context.close();
await rename(await video.path(), "artifacts/journey-preview.webm");
await browser.close();
