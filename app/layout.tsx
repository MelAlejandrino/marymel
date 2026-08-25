import type { Metadata, Viewport } from "next";
import { Caveat, Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Her handwriting, for anything she is meant to read as written by hand. */
const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["400", "600"],
});

/** A serif for the titles of notes, so they are not the same voice as the UI. */
const lora = Lora({
  variable: "--font-note",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Our world",
  description: "A small world made for one person.",
  // Added to the home screen, it launches without browser chrome — which is
  // the only way to get genuinely fullscreen on iOS.
  appleWebApp: {
    capable: true,
    title: "Our world",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // A double-tap zoom in the middle of walking is never intended.
  userScalable: false,
  // Lets the world paint under the notch and the home indicator; the HUD
  // pads itself back out with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#14101a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} ${lora.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
