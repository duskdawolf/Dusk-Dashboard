import type { ReactNode } from "react";
import { Alpha8ConventionWorkspace } from "@/components/alpha8/Alpha8ConventionWorkspace";

export default function Alpha8ConPrepLayout({
  children: _children,
}: {
  children: ReactNode;
}) {
  return <Alpha8ConventionWorkspace />;
}
