import { chromium, launchOptions } from "./browser.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await chromium.launch(launchOptions);
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  profiles: [],
};
for (const profile of [
  {
    name: "desktop",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  },
  {
    name: "mobile-emulation",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
]) {
  const { name, ...options } = profile;
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto("http://localhost:5173");
  await page.waitForFunction(
    () =>
      window.__evergreen?.world && document.body.dataset.view === "immersive",
  );
  const samples = [];
  const stops = await page.evaluate(() => window.__evergreen.stops);
  for (const stop of stops) {
    await page.evaluate((y) => scrollTo(0, y + 2), stop.start);
    await page.waitForTimeout(2600);
    samples.push({
      stop: stop.id,
      ...(await page.evaluate(() => window.__evergreen.world.metrics())),
    });
  }
  await page.evaluate(() => scrollTo(0, 0));
  const travel = await page.evaluate(async () => {
    const maximum = document.documentElement.scrollHeight - innerHeight;
    const visited = new Set();
    const run = (reverse) =>
      new Promise((resolve) => {
        const began = performance.now();
        function frame(now) {
          const fraction = Math.min(1, (now - began) / 6000);
          scrollTo(0, maximum * (reverse ? 1 - fraction : fraction));
          visited.add(document.body.dataset.active);
          if (fraction < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    await run(false);
    await run(true);
    return {
      visited: [...visited],
      endScroll: scrollY,
      metrics: window.__evergreen.world.metrics(),
    };
  });
  assert.equal(travel.endScroll, 0);
  for (const id of [
    "top",
    "statement",
    "heritage",
    "activities",
    "events",
    "contact",
  ])
    assert(travel.visited.includes(id));
  await page.locator("[data-mode=reading]").click();
  await page.waitForFunction(() => document.body.dataset.view === "reading");
  const before = await page.evaluate(
    () => window.__evergreen.world.metrics().renderedFrames,
  );
  await page.waitForTimeout(500);
  const after = await page.evaluate(
    () => window.__evergreen.world.metrics().renderedFrames,
  );
  assert.equal(after, before, "Rendering must pause in Reading view");
  await page.locator("[data-mode=immersive]").click();
  const background = await context.newPage();
  await background.goto("about:blank");
  await background.bringToFront();
  await page.waitForFunction(() => document.hidden);
  const hiddenBefore = await page.evaluate(
    () => window.__evergreen.world.metrics().renderedFrames,
  );
  await page.waitForTimeout(500);
  const hiddenAfter = await page.evaluate(
    () => window.__evergreen.world.metrics().renderedFrames,
  );
  assert.equal(hiddenAfter, hiddenBefore, "Hidden tabs must stop rendering");
  await background.close();
  report.profiles.push({
    name,
    ...options,
    samples,
    travel,
    pausesInReading: true,
    pausesInHiddenTab: true,
  });
  console.log(name, samples.map((s) => `${s.stop}: ${s.fps} fps`).join(", "));
  await context.close();
}
await writeFile("artifacts/performance.json", JSON.stringify(report, null, 2));
await browser.close();
