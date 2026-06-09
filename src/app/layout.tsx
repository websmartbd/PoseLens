import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://poselens.pro.bd/"),
  title: "Pose Lens — AI-Powered Pose Suggestion Camera",
  description:
    "Pose Lens: Point your camera at any environment and let AI suggest the perfect human pose. Get live skeleton overlays and real-time photography pose direction.",
  keywords: ["Pose Lens", "AI pose", "pose suggestion", "skeleton overlay", "photography pose", "AI photography director"],
  authors: [{ name: "Pose Lens" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "Pose Lens — AI-Powered Pose Suggestion Camera",
    description: "Pose Lens provides real-time AI pose direction for your photography.",
    type: "website",
    images: ["/images/poselens.png"],
  },
  icons: {
    icon: "/images/favicon.png",
    apple: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script data-host="https://tool.inabadawah.com" data-dnt="false" src="https://tool.inabadawah.com/js/script.js" id="ZwSg9rf6GA" async defer></script>
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
