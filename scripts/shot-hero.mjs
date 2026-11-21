import { chromium } from "@playwright/test";
const out = "C:\\Users\\PICHAU\\.gemini\\antigravity\\brain\\f46dc9ba-3b0f-4c99-9b3d-35aa86793263\\";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.addStyleTag({ content: ".lr-niche-hotspot{outline:2px solid rgba(255,40,40,.9)} .lr-niche-label{opacity:1 !important}" });
await page.waitForTimeout(1200);
await page.screenshot({ path: out + "hero2-debug.png" });
await page.addStyleTag({ content: ".lr-niche-hotspot{outline:none !important} .lr-niche-label{opacity:0 !important}" });
await page.getByRole("button", { name: /Volume 02/ }).hover();
await page.waitForTimeout(900);
await page.screenshot({ path: out + "hero2-hover.png" });
await page.mouse.move(700, 600);
await page.getByRole("button", { name: /Volume 01/ }).click();
await page.waitForTimeout(2600);
await page.screenshot({ path: out + "hero2-open.png" });
await browser.close();

