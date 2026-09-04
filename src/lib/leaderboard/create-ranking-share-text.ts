import { getGroupDisplayName } from "@/lib/groups/get-group-display-name";
import { formatScore } from "@/lib/score/format-score";

type RankingTextGroup = {
  color_name: string;
  custom_name: string;
  current_score: number;
};

export function createRankingShareText({
  campName,
  closed,
  ranking,
}: {
  campName: string;
  closed: boolean;
  ranking: RankingTextGroup[];
}) {
  const title = closed ? "ผลสรุปหลังปิดค่าย" : "อันดับล่าสุด";
  const lines = ranking.map(
    (group, index) =>
      `${index + 1}. ${group.color_name} — ${getGroupDisplayName(group.color_name, group.custom_name)} — ${formatScore(group.current_score)} คะแนน`,
  );

  return [
    "EQ-BANK",
    `${title}: ${campName}`,
    "",
    ...lines,
    "",
    "สร้างจาก EQ-BANK",
  ].join("\n");
}
