import type { Metadata } from "next";
import "@/app/globals.css";
import { Header } from "@/components/Header";
import { PWARegister } from "@/components/PWARegister";

export const metadata: Metadata = {
  title: { default: "Dusk Industries™", template: "%s | Dusk Industries™" },
  description: "Corporate polish. Furry vandalism.",
  manifest: "/manifest.webmanifest",
  themeColor: "#07101b",
  appleWebApp: { capable: true, title: "Dusk Ops", statusBarStyle: "black-translucent" },
  icons: { apple: "/icon-192.png", icon: "/icon-192.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        <Header />
        {children}
      </body>
    </html>
  );
}
