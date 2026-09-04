type RankableGroup = {
  id: string;
  current_score: number;
  score_reached_at: string | null;
  sort_order: number;
};

export function rankGroups<T extends RankableGroup>(groups: readonly T[]) {
  return [...groups]
    .sort((left, right) => {
      if (left.current_score !== right.current_score) {
        return right.current_score - left.current_score;
      }

      const leftTime = left.score_reached_at
        ? Date.parse(left.score_reached_at)
        : Number.POSITIVE_INFINITY;
      const rightTime = right.score_reached_at
        ? Date.parse(right.score_reached_at)
        : Number.POSITIVE_INFINITY;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.sort_order - right.sort_order;
    })
    .map((group, index) => ({ ...group, rank: index + 1 }));
}
