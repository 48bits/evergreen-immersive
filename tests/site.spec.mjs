import { test, expect } from "@playwright/test";

const chapters = [
  "top",
  "statement",
  "heritage",
  "activities",
  "events",
  "contact",
];
async function ready(page, view = "immersive") {
  await expect(page.locator("body")).toHaveAttribute("data-view", view);
  await expect(page.locator("body")).toHaveClass(/js/);
}
async function navigate(page, chapter) {
  if (await page.locator(".menu-toggle").isVisible())
    await page.locator(".menu-toggle").click();
  await page.locator(`#chapter-nav a[href="#${chapter}"]`).click();
  await expect(page.locator("body")).toHaveAttribute("data-active", chapter);
  await expect(
    page.locator(`#chapter-nav a[href="#${chapter}"]`),
  ).toHaveAttribute("aria-current", "location");
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}
async function reachable(page, selector) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  const rect = await element.boundingBox();
  expect(rect).not.toBeNull();
  const h = await page.evaluate(() => innerHeight);
  expect(rect.y).toBeLessThan(h - 65);
  expect(rect.y + rect.height).toBeGreaterThan(85);
}

test("entry, forward and reverse navigation, history, and email", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "Explore our world" }).click();
  await expect(page).toHaveURL(/#statement$/);
  await expect(page.locator("body")).toHaveAttribute(
    "data-active",
    "statement",
  );
  for (const id of chapters.slice(2)) await navigate(page, id);
  await expect(page.locator(".email-link")).toHaveAttribute(
    "href",
    "mailto:info@evergreen.com",
  );
  await page.goBack();
  await expect(page.locator("body")).toHaveAttribute("data-active", "events");
  await page.goForward();
  await expect(page.locator("body")).toHaveAttribute("data-active", "contact");
  for (const id of [...chapters].reverse()) await navigate(page, id);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("all fragment reloads reach the requested chapter", async ({ page }) => {
  for (const id of chapters) {
    await page.goto(`/#${id}`);
    await ready(page);
    await expect(page.locator("body")).toHaveAttribute("data-active", id);
    await page.reload();
    await ready(page);
    await expect(page.locator("body")).toHaveAttribute("data-active", id);
  }
});

test("reading selection persists and switching retains activities and chapters", async ({
  page,
}) => {
  await page.goto("/#events");
  await ready(page);
  for (const mode of ["reading", "immersive", "reading"]) {
    await page.locator(`[data-mode=${mode}]`).click();
    await ready(page, mode);
    await expect(page.locator("body")).toHaveAttribute("data-active", "events");
  }
  await page.reload();
  await ready(page, "reading");
  await expect(page.locator("#world canvas")).toHaveCount(0);
  await navigate(page, "contact");
  await page.locator(".footer-links [data-destination=direct]").click();
  await expect(page.locator("#direct-title")).toBeInViewport();
  await page.locator("[data-mode=immersive]").click();
  await ready(page);
  await expect(page.locator("#direct-title")).toBeInViewport();
  await page.locator("[data-mode=reading]").click();
  await expect(page.locator("#direct-title")).toBeInViewport();
});

test("reduced motion defaults to reading and reacts to preference changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#heritage");
  await ready(page, "reading");
  await expect(page.locator("#world canvas")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator("[data-mode=immersive]").click();
  await ready(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "reading");
  await expect(page.locator("body")).toHaveAttribute("data-active", "heritage");
});

test("JavaScript disabled leaves complete content, local illustrations, and native links", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:4173");
  await expect(page.locator("body")).toHaveAttribute("data-view", "reading");
  await expect(
    page.getByRole("heading", { name: "Evergreen Growth." }),
  ).toBeVisible();
  await expect(page.locator(".scene-illustration img")).toHaveCount(8);
  for (const id of chapters) {
    await page.locator(`#chapter-nav a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
  }
  await reachable(page, ".event:last-child h3");
  await noOverflow(page);
  await context.close();
});

test("unavailable WebGL falls back without losing a fragment", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/webgl/.test(type)) return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto("/#heritage");
  await expect(page.locator("[data-mode=immersive]")).toBeDisabled();
  await ready(page, "reading");
  await expect(page.locator("body")).toHaveAttribute("data-active", "heritage");
  await expect(page.locator("#heritage-title")).toBeInViewport();
});

test("WebGL context loss preserves the active chapter in reading view", async ({
  page,
}) => {
  await page.goto("/#events");
  await ready(page);
  await page.locator("#world canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error("Context loss extension is required for this check");
    extension.loseContext();
  });
  await ready(page, "reading");
  await expect(page.locator("body")).toHaveAttribute("data-active", "events");
  await expect(page.locator("[data-mode=immersive]")).toBeDisabled();
  await expect(page.locator("#events-title")).toBeInViewport();
});

test("slow scene loading leaves immediate content and working chapter links", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/world-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-view", "reading");
  await navigate(page, "heritage");
  release();
  await ready(page);
  await expect(page.locator("body")).toHaveAttribute("data-active", "heritage");
});

test("keyboard skip link, chapter menu, focus loop, and escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await ready(page);
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#statement-title")).toBeFocused();
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.locator("#chapter-nav a").first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".menu-toggle")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#chapter-nav a").first()).toBeFocused();
  await page.locator("#chapter-nav a").last().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".menu-toggle")).toBeFocused();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator(".menu-toggle")).toBeFocused();
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  await navigate(page, "events");
  await expect(page.locator("#events-title")).toBeFocused();
});

for (const viewport of [
  { width: 390, height: 844, name: "mobile portrait" },
  { width: 844, height: 390, name: "mobile landscape" },
  { width: 768, height: 1024, name: "tablet portrait" },
  { width: 1024, height: 768, name: "tablet landscape" },
  { width: 720, height: 500, name: "200% equivalent viewport" },
]) {
  test(`${viewport.name}: content remains reachable in both views`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await ready(page);
    for (const mode of ["immersive", "reading"]) {
      await page.locator(`[data-mode=${mode}]`).click();
      await ready(page, mode);
      for (const id of ["heritage", "activities", "events", "contact"]) {
        await navigate(page, id);
        await noOverflow(page);
      }
      for (const selector of [
        ".principles li:last-child p",
        "[data-stop=giving] .tags",
        ".event:last-child p:last-child",
        ".legal",
      ])
        await reachable(page, selector);
    }
  });
}

test("content audit: statistics, sectors, dates, legal name, and silence", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await ready(page, "reading");
  expect(await page.locator(".stats dd").allTextContents()).toEqual([
    "5",
    "2",
    "8+",
    "∞",
  ]);
  expect(
    await page
      .locator("time")
      .evaluateAll((times) => times.map((time) => time.dateTime)),
  ).toEqual(["2024-09-27", "2024-05-02", "2024-02-27"]);
  for (const phrase of [
    "pre-seed and seed",
    "fintech",
    "blockchain",
    "autonomous driving",
    "enterprise SaaS",
    "VR",
    "STEM",
    "leading US universities",
    "early education in Singapore",
    "$50+ trillion",
    "Evergreen Growth Pte. Ltd.",
  ])
    await expect(page.locator("main")).toContainText(phrase);
  await expect(page.locator("audio,video,iframe")).toHaveCount(0);
  await expect(page.locator(".archive-label")).toHaveText(
    "Past gatherings / 2024",
  );
  for (const image of await page.locator(".scene-illustration img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
});
