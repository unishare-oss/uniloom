import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service · Uniloom" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <h2>Using Uniloom</h2>
      <p>
        Uniloom tracks software work: features, slices, designs and reviews. You
        sign in with your uniAuth account. These terms cover Uniloom only.
      </p>
      <h2>Your account and your agent</h2>
      <p>
        Keep your uniAuth sign-in and your agent access tokens safe. What your
        agent does in Uniloom with your token is done as you.
      </p>
      <h2>Ending your use</h2>
      <p>
        You can stop using Uniloom at any time. Deleting your uniAuth account
        also deletes your Uniloom account and your workspace memberships.
      </p>
    </LegalPage>
  );
}
