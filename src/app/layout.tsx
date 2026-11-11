import { Atkinson_Hyperlegible } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const body = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "Hotseat",
  description: "AI-driven interview practice",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={body.variable}>
      <body>{children}</body>
    </html>
  );
}
