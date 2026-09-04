import { LeaderboardScreen } from "@/components/leaderboard/leaderboard-screen";

type LeaderboardPageProps = {
  params: Promise<{ publicCode: string }>;
};

export default async function LeaderboardPage({
  params,
}: LeaderboardPageProps) {
  const { publicCode } = await params;
  return <LeaderboardScreen publicCode={publicCode} />;
}
