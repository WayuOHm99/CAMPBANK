export type Role = "admin" | "staff";
export type Permission =
  | "score"
  | "history:read"
  | "budget:update"
  | "camp:close"
  | "camp:configure"
  | "adjustment:create";

const staffPermissions = new Set<Permission>(["score", "history:read"]);

export function canPerform(role: Role, permission: Permission) {
  return role === "admin" || staffPermissions.has(permission);
}
