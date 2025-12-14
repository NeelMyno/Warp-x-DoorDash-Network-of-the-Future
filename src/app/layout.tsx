import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  "http://localhost:3000";

const fontUi = Geist({
  subsets: ["latin"],
  variable: "--font-ui",
});

const fontCode = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-code",
});

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
    <html lang="en" className="h-full">
      <body
        className={`${fontUi.variable} ${fontCode.variable} min-h-full antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
