// Optional visible Chromium check on Linux/X11. Targets only this verification window.
import { chromium, launchOptions } from "./browser.mjs";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

if (!process.env.DISPLAY)
  throw new Error(
    "This check requires a visible X11 session. The main test suite also checks a 200% equivalent viewport.",
  );
const browser = await chromium.launch({ ...launchOptions, headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:5173");
await page.waitForFunction(() => document.body.dataset.view === "immersive");
await page.evaluate(() => {
  document.title = "Evergreen isolated zoom verification";
});
await page.bringToFront();
const before = await page.evaluate(() => ({
  width: innerWidth,
  height: innerHeight,
  dpr: devicePixelRatio,
}));
execFileSync("python3", [
  "-c",
  `
import ctypes, subprocess, re, time
matches = []
for _ in range(20):
 tree = subprocess.check_output(['xwininfo', '-root', '-tree'], text=True)
 matches = re.findall(r'(0x[0-9a-f]+) "Evergreen isolated zoom verification[^"\\n]*"', tree)
 if len(matches) == 1: break
 time.sleep(.1)
if len(matches) != 1: raise RuntimeError('Could not uniquely identify the verification window')
x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XFlush.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
if not display: raise RuntimeError('X11 display unavailable')
x11.XSetInputFocus(display, int(matches[0], 16), 1, 0)
ctrl = x11.XKeysymToKeycode(display, 0xffe3)
equal = x11.XKeysymToKeycode(display, 0x003d)
for _ in range(5):
 xtst.XTestFakeKeyEvent(display, ctrl, 1, 0)
 xtst.XTestFakeKeyEvent(display, equal, 1, 0)
 xtst.XTestFakeKeyEvent(display, equal, 0, 0)
 xtst.XTestFakeKeyEvent(display, ctrl, 0, 0)
 x11.XFlush(display)
 time.sleep(.12)
`,
]);
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  width: innerWidth,
  height: innerHeight,
  dpr: devicePixelRatio,
}));
assert(
  Math.abs(after.dpr / before.dpr - 2) < 0.05,
  `Expected actual browser zoom 200%, got ${JSON.stringify(after)}`,
);
for (const mode of ["immersive", "reading"]) {
  await page.locator(`[data-mode=${mode}]`).click();
  for (const id of ["heritage", "activities", "events", "contact"]) {
    await page.locator(".menu-toggle").click();
    await page.locator(`#chapter-nav a[href="#${id}"]`).click();
    assert(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    );
  }
  await page.screenshot({ path: `artifacts/browser-zoom-200-${mode}.png` });
}
await writeFile(
  "artifacts/browser-zoom.json",
  JSON.stringify(
    { before, after, actualZoom: "200%", overflow: false },
    null,
    2,
  ),
);
console.log({ before, after });
await browser.close();
