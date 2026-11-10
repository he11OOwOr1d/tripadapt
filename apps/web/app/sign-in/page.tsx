import AuthForm from "../design/auth-studies/trail-companion/AuthForm";
import { tripReturn } from "../../lib/auth/config";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      live
      initialMode="signin"
      returnTo={tripReturn(params.next)}
      linkExpired={params.message === "link-expired"}
    />
  );
}
