import { chromium, launchOptions } from "./browser.mjs";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.goto("http://localhost:5173");
await page.waitForFunction(() => document.body.dataset.view === "immersive");
const results = [];
for (const mode of ["immersive", "reading"]) {
  await page.locator(`[data-mode=${mode}]`).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  results.push({
    mode,
    violations: result.violations,
    incomplete: result.incomplete.map((item) => ({
      id: item.id,
      description: item.description,
    })),
  });
  console.log(
    mode,
    result.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  );
}
await writeFile(
  "artifacts/accessibility.json",
  JSON.stringify(results, null, 2),
);
await browser.close();
if (results.some((result) => result.violations.length)) process.exitCode = 1;
