import { LeaderboardScreen } from "@/components/leaderboard/leaderboard-screen";
import { MotionPage } from "@/components/shared/motion";

type LeaderboardPageProps = {
  params: Promise<{ publicCode: string }>;
};

export default async function LeaderboardPage({
  params,
}: LeaderboardPageProps) {
  const { publicCode } = await params;
  return (
    <MotionPage>
      <LeaderboardScreen publicCode={publicCode} />
    </MotionPage>
  );
}
