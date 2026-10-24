import { redirect } from "next/navigation";

/**
 * GitHub's Setup URL: after installing the App it sends the Owner here with the project id
 * we gave it as `state`. Straight on to that project's Settings, where the repos are mapped.
 */
const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) => {
  const { state } = await searchParams;
  redirect(state ? `/p/${encodeURIComponent(state)}/settings#github` : "/");
};

export default Page;
