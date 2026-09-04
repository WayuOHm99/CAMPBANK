import { StaffJoinScreen } from "@/components/staff/staff-join-screen";

type JoinPageProps = {
  params: Promise<{ campCode: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { campCode } = await params;
  return <StaffJoinScreen campCode={campCode} />;
}
