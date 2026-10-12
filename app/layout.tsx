import { AuthProvider } from "@/components/session-provider";
import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Orbit — AI agent workspace",
  description: "Build AI agents, connect your tools, and automate repeatable work in Orbit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster/>
      </body>
    </html>
  );
}
