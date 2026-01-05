import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { AppBackground } from "@/components/shell/AppBackground";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  "http://localhost:3000";

/**
 * Typography: Satoshi (from Fontshare CDN)
 * - Single font for both UI and numbers (no monospace)
 * - Use `tabular-nums` utility for aligned numeric columns
 * - CSS import in globals.css handles font loading
 */

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Warp x DoorDash Portal",
    template: "%s · Warp x DoorDash Portal",
  },
  description: "Warp x DoorDash: Network of the Future Portal",
  icons: {
    icon: "/media/favicon.png",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Warp x DoorDash Portal",
    description: "Warp x DoorDash: Network of the Future Portal",
    images: [
      {
        url: "/media/open_graph_image_wearewarp.com.png",
        alt: "Warp x DoorDash: Network of the Future Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Warp x DoorDash Portal",
    description: "Warp x DoorDash: Network of the Future Portal",
    images: [
      {
        url: "/media/open_graph_image_wearewarp.com.png",
        alt: "Warp x DoorDash: Network of the Future Portal",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className="min-h-full antialiased"
        suppressHydrationWarning
      >
        <AppBackground />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "bg-card text-foreground border-border",
          }}
        />
      </body>
    </html>
  );
}
