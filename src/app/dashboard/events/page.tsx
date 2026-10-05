import { Suspense } from "react";
import { UnifiedEventsPage } from "@/components/alpha92/UnifiedEventsPage";

export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <UnifiedEventsPage />
    </Suspense>
  );
}
