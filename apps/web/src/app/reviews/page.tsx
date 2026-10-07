import { ReviewInbox } from "@/components/reviews/review-inbox";
import { AppShell } from "@/components/shell/app-shell";

const ReviewsPage = () => {
  return (
    <AppShell>
      <ReviewInbox />
    </AppShell>
  );
};

export default ReviewsPage;
