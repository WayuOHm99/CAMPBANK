import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch();
const shots = [
  { name: "home-mobile", ...devices["iPhone 13"] },
  { name: "home-desktop", viewport: { width: 1440, height: 900 } },
];

for (const { name, ...opts } of shots) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `.scratch/shots/${name}.png`, fullPage: false });
  const h1 = await page.getByRole("heading", { level: 1 }).innerText();
  console.log(`${name}: h1=${JSON.stringify(h1)} errors=${errors.length}`);
  await ctx.close();
}
await browser.close();
