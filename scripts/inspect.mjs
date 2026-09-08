import { chromium, launchOptions } from "./browser.mjs";
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.log("ERROR", error.message));
page.on("console", (message) => {
  if (message.type() === "warning" || message.type() === "error")
    console.log(message.type(), message.text().slice(0, 600));
});
await page.goto("http://localhost:5173");
await page.waitForFunction(() => document.body.dataset.view === "immersive", {
  timeout: 30000,
});
await page.waitForTimeout(2500);
console.log(
  await page.evaluate(() => ({
    metrics: window.__evergreen.world.metrics(),
    stops: window.__evergreen.stops,
    scroll: scrollY,
    body: document.body.scrollHeight,
  })),
);
await page.screenshot({ path: "artifacts/initial-desktop.png" });
await browser.close();
