import type { ReactNode } from "react";
import { Alpha7ConventionOpsDock } from "@/components/alpha7/Alpha7ConventionOpsDock";

export default function Alpha7ConPrepLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Alpha7ConventionOpsDock />
      {children}
    </>
  );
}
