import type { Metadata } from "next";
import "@/app/globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: { default: "Dusk Industries™", template: "%s | Dusk Industries™" },
  description: "Corporate polish. Furry vandalism.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
