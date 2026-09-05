import { HistoryScreen } from "@/components/history/history-screen";
import { MotionPage } from "@/components/shared/motion";

type HistoryPageProps = {
  params: Promise<{ campId: string }>;
};

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { campId } = await params;
  return (
    <MotionPage>
      <HistoryScreen campId={campId} />
    </MotionPage>
  );
}
