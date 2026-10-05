import { EventLifecycleWorkspace } from "@/components/alpha92/EventLifecycleWorkspace";

export default async function EventLifecyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventLifecycleWorkspace eventId={id} />;
}
