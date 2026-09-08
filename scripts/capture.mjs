import { chromium, launchOptions } from "./browser.mjs";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
await page.goto("http://localhost:5173");
await page.waitForFunction(
  () => window.__evergreen?.world && document.body.dataset.view === "immersive",
);
const ids = [
  "top",
  "statement",
  "heritage",
  "funds",
  "direct",
  "giving",
  "events",
  "contact",
];
for (let i = 0; i < ids.length; i++) {
  const data = await page.evaluate(
    (index) => window.__evergreen.world.snapshot(index),
    i,
  );
  await writeFile(
    `public/images/${ids[i]}.webp`,
    Buffer.from(data.split(",")[1], "base64"),
  );
  console.log("Illustration:", ids[i]);
}
await page.reload();
await page.waitForFunction(() => document.body.dataset.view === "immersive");
for (const id of ids) {
  await page.evaluate(
    (id) =>
      window.scrollTo(
        0,
        window.__evergreen.stops.find((s) => s.id === id).start + 2,
      ),
    id,
  );
  await page.waitForTimeout(450);
  await page.screenshot({ path: `artifacts/desktop-${id}.png` });
}
await page.getByRole("button", { name: "Reading", exact: true }).click();
await page.screenshot({
  path: "artifacts/desktop-reading.png",
  fullPage: true,
});
console.log("Desktop screenshots complete");
await page.close();
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await mobile.goto("http://localhost:5173");
await mobile.waitForFunction(() => document.body.dataset.view === "immersive");
for (const id of ids) {
  await mobile.evaluate(
    (id) =>
      window.scrollTo(
        0,
        window.__evergreen.stops.find((s) => s.id === id).start + 2,
      ),
    id,
  );
  await mobile.waitForTimeout(450);
  await mobile.screenshot({ path: `artifacts/mobile-${id}.png` });
}
await mobile.getByRole("button", { name: "Reading", exact: true }).click();
await mobile.screenshot({
  path: "artifacts/mobile-reading.png",
  fullPage: true,
});
await writeFile(
  "artifacts/capture-info.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      desktop: { width: 1440, height: 1000 },
      mobile: { width: 390, height: 844 },
    },
    null,
    2,
  ),
);
await browser.close();
