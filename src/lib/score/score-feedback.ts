/** Compare each Group independently: a local write must not hide another Group's update. */
export function remoteScoreChanges<
  Group extends { id: string; current_score: number },
>(
  groups: Group[],
  baseline: ReadonlyMap<string, number>,
  recentTransactions: Array<{ id: string; group_id: string }>,
  localTransactionIds: ReadonlySet<string>,
): Group[] {
  return groups.filter((group) => {
    if (
      !baseline.has(group.id) ||
      baseline.get(group.id) === group.current_score
    )
      return false;
    const newest = recentTransactions.find(
      (transaction) => transaction.group_id === group.id,
    );
    return !newest || !localTransactionIds.has(newest.id);
  });
}
