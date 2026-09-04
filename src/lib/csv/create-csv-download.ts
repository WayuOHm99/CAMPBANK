export type CsvValue = boolean | number | string | null | undefined;

function serializeCsvCell(value: CsvValue) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  let text = value == null ? "" : String(value);
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function createCsvText(rows: readonly (readonly CsvValue[])[]) {
  return `\ufeff${rows
    .map((row) => row.map(serializeCsvCell).join(","))
    .join("\r\n")}`;
}

export function downloadCsv(
  filename: string,
  rows: readonly (readonly CsvValue[])[],
) {
  const safeFilename = filename
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const finalFilename = `${safeFilename || "eqcamp-export"}.csv`;
  const blob = new Blob([createCsvText(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = finalFilename;
  anchor.href = url;
  anchor.setAttribute("aria-hidden", "true");
  anchor.tabIndex = -1;
  anchor.style.position = "fixed";
  anchor.style.insetInlineStart = "-9999px";
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1_000);
}
