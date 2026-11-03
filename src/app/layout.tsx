import type { ReactNode } from "react";

export const metadata = {
  title: "Hotseat",
  description: "AI-driven interview practice",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
