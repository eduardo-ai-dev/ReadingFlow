import { chromium } from "@playwright/test";

const out = "C:\\Users\\PICHAU\\.gemini\\antigravity\\brain\\f46dc9ba-3b0f-4c99-9b3d-35aa86793263\\";
const which = process.argv[2] ?? "before";

const browser = await chromium.launch();
async function session(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/entrar", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Entrar na Biblioteca Demo/i }).click();
  await page.waitForURL(/\/painel/);
  await page.waitForTimeout(1500);
  return page;
}

const d = await session({ width: 1440, height: 900 });
await d.screenshot({ path: out + `${which}-painel-desktop.png`, fullPage: true });
await d.goto("http://localhost:3000/estantes", { waitUntil: "networkidle" });
await d.waitForTimeout(1000);
await d.screenshot({ path: out + `${which}-estantes-desktop.png`, fullPage: false });
if (which !== "before") {
  await d.goto("http://localhost:3000/metas", { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  await d.screenshot({ path: out + `${which}-metas-desktop.png` });
  await d.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await d.waitForTimeout(1200);
  await d.screenshot({ path: out + `${which}-landing-desktop.png` });
}
const m = await session({ width: 390, height: 844 }, true);
await m.screenshot({ path: out + `${which}-painel-mobile.png`, fullPage: true });
await browser.close();
console.log("done");

