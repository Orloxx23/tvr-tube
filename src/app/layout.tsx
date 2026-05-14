import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TVR Tube — Descarga videos de YouTube hasta 4K",
    template: "%s · TVR Tube",
  },
  description:
    "Convierte enlaces de YouTube en descargas limpias hasta 2160p o pistas de audio MP3/M4A. Solo para uso personal.",
  applicationName: "TVR Tube",
  authors: [{ name: "TVR Tube" }],
  keywords: [
    "youtube downloader",
    "4k",
    "1080p",
    "mp3",
    "audio",
    "yt-dlp",
    "ffmpeg",
  ],
  robots: { index: false, follow: false },
  openGraph: {
    title: "TVR Tube — Descarga videos de YouTube hasta 4K",
    description:
      "Pega el enlace, elige la calidad, recibe el archivo. Hasta 2160p o audio MP3.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="bg-background text-foreground font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
