import type { Metadata } from "next";
import { Guide } from "@/components/guide/guide";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "User guide · Uniloom" };

const GuidePage = () => {
  return (
    <AppShell>
      <Guide />
    </AppShell>
  );
};

export default GuidePage;
