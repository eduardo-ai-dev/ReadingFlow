import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "C:/Users/PICHAU/.gemini/antigravity/brain/f46dc9ba-3b0f-4c99-9b3d-35aa86793263";

async function run() {
  const browser = await chromium.launch();

  // 1. Desktop - Resting
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "hero-showcase-desktop-rest.png") });
    await page.close();
  }

  // 2. Desktop - Debug Hotspots
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000/?debug=hotspots");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "hero-showcase-desktop-debug.png") });
    await page.close();
  }

  // 3. Desktop - 3D Showcase Dialog Open
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Abrir a ala Clássicos" }).click();
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(400); // Wait for transition
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "hero-showcase-desktop-open.png") });
    await page.close();
  }

  // 4. Mobile - Resting
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "hero-showcase-mobile-rest.png") });
    await page.close();
  }

  // 5. Mobile - 3D Showcase Dialog Open
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Abrir a ala Clássicos" }).click();
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "hero-showcase-mobile-open.png") });
    await page.close();
  }

  await browser.close();
  console.log("Screenshots saved successfully!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

