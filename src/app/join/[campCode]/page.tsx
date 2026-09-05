import { StaffJoinScreen } from "@/components/staff/staff-join-screen";
import { MotionPage } from "@/components/shared/motion";

type JoinPageProps = {
  params: Promise<{ campCode: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { campCode } = await params;
  return (
    <MotionPage>
      <StaffJoinScreen campCode={campCode} />
    </MotionPage>
  );
}
