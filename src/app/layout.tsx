import type { Metadata } from "next";
import { APP_URL } from "@/lib/config";
import "./globals.css";

function appUrl(): URL {
  try {
    return new URL(APP_URL);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: appUrl(),
  title:
    "TailorMe by Res.Me · Your experience is stronger than your resume makes it look",
  description:
    "Paste a job posting. TailorMe rewrites your resume for it, then three specialist agents review the draft the way the ATS, the recruiter, and the hiring manager will, and return fixes, not a score. First application free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
