import { Suspense } from "react";
import { DeploymentListPage } from "@/components/alpha91/DeploymentListPage";

export default function DeploymentsPage() {
  return (
    <Suspense fallback={null}>
      <DeploymentListPage />
    </Suspense>
  );
}
