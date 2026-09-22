import type { Metadata } from "next";
import "@/app/globals.css";
import { Header } from "@/components/Header";
import { PWARegister } from "@/components/PWARegister";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Dusk Industries™", template: "%s | Dusk Industries™" },
  description: "Corporate polish. Furry vandalism.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Dusk Ops", statusBarStyle: "black-translucent" },
  icons: { apple: "/icon-192.png", icon: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#07101b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        <Header />
        <div className="min-h-[calc(100vh-88px)]">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
