import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
const local =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  "/home/charlie/.cache/ms-playwright/chromium-1217/chrome-linux/chrome";
export const launchOptions = {
  headless: !process.env.DISPLAY,
  ...(existsSync(local) ? { executablePath: local } : {}),
  args: [
    "--no-sandbox",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    ...(process.env.DISPLAY
      ? ["--use-gl=angle", "--use-angle=gl"]
      : ["--enable-unsafe-swiftshader"]),
  ],
};
export { chromium };
