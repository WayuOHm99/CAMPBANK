import { CampScreen } from "@/components/staff/camp-screen";
import { MotionPage } from "@/components/shared/motion";

type CampPageProps = {
  params: Promise<{ campId: string }>;
};

export default async function CampPage({ params }: CampPageProps) {
  const { campId } = await params;
  return (
    <MotionPage>
      <CampScreen campId={campId} />
    </MotionPage>
  );
}
