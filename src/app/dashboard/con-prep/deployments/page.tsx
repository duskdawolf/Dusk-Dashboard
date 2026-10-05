import { redirect } from "next/navigation";

export default function LegacyDeploymentListRedirect() {
  redirect("/dashboard/events");
}
