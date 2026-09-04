import { HistoryScreen } from "@/components/history/history-screen";

type HistoryPageProps = {
  params: Promise<{ campId: string }>;
};

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { campId } = await params;
  return <HistoryScreen campId={campId} />;
}
