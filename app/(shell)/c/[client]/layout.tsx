import { RememberClient } from "@/components/shell/remember-client";
import { requireClient } from "@/lib/shell";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { client: string };
}) {
  // 404s for unknown slugs and for clients outside the user's scope.
  const { client } = await requireClient(params.client);
  return (
    <>
      <RememberClient slug={client.slug} />
      {children}
    </>
  );
}
