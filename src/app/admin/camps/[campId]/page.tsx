import { AdminCampScreen } from "@/components/admin/admin-camp-screen";

type AdminCampPageProps = {
  params: Promise<{ campId: string }>;
};

export default async function AdminCampPage({ params }: AdminCampPageProps) {
  const { campId } = await params;
  return <AdminCampScreen campId={campId} />;
}
