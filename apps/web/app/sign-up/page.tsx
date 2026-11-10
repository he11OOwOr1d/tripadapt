import AuthForm from "../design/auth-studies/trail-companion/AuthForm";
import { tripReturn } from "../../lib/auth/config";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm live initialMode="signup" returnTo={tripReturn(params.next)} />
  );
}
