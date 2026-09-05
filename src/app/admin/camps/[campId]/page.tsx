import { AdminCampScreen } from "@/components/admin/admin-camp-screen";
import { MotionPage } from "@/components/shared/motion";

type AdminCampPageProps = {
  params: Promise<{ campId: string }>;
};

export default async function AdminCampPage({ params }: AdminCampPageProps) {
  const { campId } = await params;
  return (
    <MotionPage>
      <AdminCampScreen campId={campId} />
    </MotionPage>
  );
}
