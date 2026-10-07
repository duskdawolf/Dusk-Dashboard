import { notFound } from "next/navigation";
import { getDashboardUser } from "@/lib/auth";
import { DirectoryManager } from "@/components/convention-directory/DirectoryManager";

export default async function ConventionDirectoryPage() {
  const user = await getDashboardUser();
  if (user?.role !== "admin") notFound();
  return <DirectoryManager />;
}
