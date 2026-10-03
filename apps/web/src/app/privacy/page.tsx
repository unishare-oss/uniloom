import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · Uniloom" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What we keep</h2>
      <p>
        From uniAuth: your name, email address, whether the email is verified,
        and your profile picture. Uniloom also keeps your sign-in sessions, when
        you accepted these terms, and the work you and your agent record in your
        workspaces.
      </p>
      <h2>Why</h2>
      <p>
        To sign you in, show who did what, and run Uniloom&rsquo;s features for
        you.
      </p>
      <h2>Changes and deletion</h2>
      <p>
        Changes to your name, email or picture on uniAuth are copied to Uniloom.
        Deleting your uniAuth account deletes your Uniloom account.
      </p>
    </LegalPage>
  );
}
