import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./v11.css";
import "./v12.css";
import "./v13.css";
import "./v14.css";
import "./v15.css";
import "./v16.css";
import "./enterprise-theme.css";

export const metadata: Metadata = {
  title: "Leonidas Tech — LeoTechScan",
  description: "Inteligência geográfica para infraestrutura telecom",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
