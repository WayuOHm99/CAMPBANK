import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:3000/join/DEMO-STAFF-2026", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Staff B" }).click();
await page.getByRole("group", { name: "รูปแบบการแสดงกลุ่ม" })
  .getByRole("button", { name: "แถวเลื่อน" }).click();
await page.waitForTimeout(300);

const read = () => page.evaluate(() => {
  const list = document.querySelector('[role="list"][aria-label="กลุ่มคะแนน"]');
  const cs = getComputedStyle(list);
  return {
    doc: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
    list: `w=${Math.round(list.getBoundingClientRect().width)} scrollW=${list.scrollWidth} overflowX=${cs.overflowX}`,
    parent: `${Math.round(list.parentElement.getBoundingClientRect().width)} display=${getComputedStyle(list.parentElement).display}`,
  };
});
console.log("as shipped   ", JSON.stringify(await read()));

// put the card back to a column and re-measure — isolates my change
await page.addStyleTag({ content: `[role="listitem"]{flex-direction:column !important}` });
await page.waitForTimeout(300);
console.log("card=column  ", JSON.stringify(await read()));
await browser.close();
