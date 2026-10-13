import { JoinPage } from "@/components/invites/join-page";
import { AppShell } from "@/components/shell/app-shell";

/** Where an invite link leads. Signed-out visitors sign in first (see proxy.ts). */
const Page = async ({ params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  return (
    <AppShell>
      <JoinPage token={token} />
    </AppShell>
  );
};

export default Page;
