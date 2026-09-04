import { describe, expect, it } from "vitest";

import { createCsvText } from "@/lib/csv/create-csv-download";

describe("createCsvText", () => {
  it("adds a UTF-8 BOM, preserves numeric values, and escapes CSV cells", () => {
    expect(
      createCsvText([
        ["ชื่อ", "คะแนน", "หมายเหตุ"],
        ["สาย,หนึ่ง", -500, 'มี "เครื่องหมาย"'],
      ]),
    ).toBe(
      '\ufeffชื่อ,คะแนน,หมายเหตุ\r\n"สาย,หนึ่ง",-500,"มี ""เครื่องหมาย"""',
    );
  });

  it("guards text cells that spreadsheet programs could treat as formulas", () => {
    expect(
      createCsvText([
        ["ชื่อ", "คะแนน"],
        ['=HYPERLINK("https://example.com")', 500],
        ["+ชื่อกลุ่ม", 0],
      ]),
    ).toContain("'=HYPERLINK");
    expect(createCsvText([["-ชื่อกลุ่ม"]])).toContain("'-ชื่อกลุ่ม");
    expect(createCsvText([["@ชื่อกลุ่ม"]])).toContain("'@ชื่อกลุ่ม");
  });
});
