export type CampStatus = "draft" | "active" | "closed";

const CAMP_STATUS_LABELS: Record<CampStatus, string> = {
  draft: "ค่ายฉบับร่าง",
  active: "กำลังใช้งาน",
  closed: "ปิดค่ายแล้ว",
};

export function getCampStatusLabel(status: CampStatus) {
  return CAMP_STATUS_LABELS[status];
}
