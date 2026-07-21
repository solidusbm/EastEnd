import DisplayClient from "./DisplayClient";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  return <DisplayClient screenId={screenId} />;
}
