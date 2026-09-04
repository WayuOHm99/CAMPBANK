export function getGroupDisplayName(
  colorName: string,
  customName: string,
): string {
  return customName.trim() || `กลุ่มสี${colorName}`;
}
