import { CampScreen } from "@/components/staff/camp-screen";

type CampPageProps = {
  params: Promise<{ campId: string }>;
};

export default async function CampPage({ params }: CampPageProps) {
  const { campId } = await params;
  return <CampScreen campId={campId} />;
}
