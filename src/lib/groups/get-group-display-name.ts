export function getGroupDisplayName(
  colorName: string,
  customName: string,
): string {
  return customName.trim() || `กลุ่มสี${colorName}`;
}

/** Color plus name, without repeating the color when no name was chosen. */
export function getGroupLabel(colorName: string, customName: string): string {
  return customName.trim()
    ? `${colorName} — ${customName.trim()}`
    : getGroupDisplayName(colorName, customName);
}
