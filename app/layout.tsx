import type { Metadata } from "next";
import { Geist_Mono, Inter, Raleway } from "next/font/google";

import { cn } from "@/lib/utils";

import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Brand typeface (MD Fashion Center kit): page titles, headings and the product name.
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MD Fashion Center", template: "%s · MD Fashion Center" },
  description: "Garment production, inventory and order management.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased font-sans", inter.variable, raleway.variable, geistMono.variable)}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
