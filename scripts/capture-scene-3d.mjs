import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const artifactDir = "C:\\Users\\PICHAU\\.gemini\\antigravity\\brain\\01bef34d-3241-4e8e-91ed-6649573685d2";
const scratchDir = path.join(artifactDir, "scratch");
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await desktopContext.newPage();
  const consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleLogs.push(`[PAGEERROR] ${err.message}`));

  console.log("Navigating to http://localhost:3000/...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

  // Wait for Three.js render and dolly intro to finish
  await page.waitForTimeout(3500);

  const desktopPath = path.join(scratchDir, "scene-3d-desktop.png");
  await page.screenshot({ path: desktopPath });
  console.log("Saved desktop screenshot to:", desktopPath);

  // Mobile screenshot
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(3000);

  const mobilePath = path.join(scratchDir, "scene-3d-mobile.png");
  await mobilePage.screenshot({ path: mobilePath });
  console.log("Saved mobile screenshot to:", mobilePath);

  console.log("Console logs recorded (" + consoleLogs.length + "):");
  consoleLogs.slice(-10).forEach((l) => console.log("  ", l));

  await browser.close();
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});

