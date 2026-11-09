import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TripAdapt — Find your elsewhere",
  description:
    "Find your somewhere. Shape a connected trip around it, and adapt as you go.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
