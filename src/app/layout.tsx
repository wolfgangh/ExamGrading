import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { AuthGate } from "@/components/auth/auth-gate";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APPEARANCE_STORAGE_KEY } from "@/lib/preferences";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  preload: true,
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "ExamGrade – Prüfungsnoten-Tool",
  description:
    "Client-seitige Notenvergabe und HISinOne-Export für Prüfungen an deutschen Hochschulen.",
};

const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)});
    var prefs = raw ? JSON.parse(raw) : { colorMode: "light", fontFamily: "sans", highContrast: false, fontScale: "md" };
    var root = document.documentElement;
    if (prefs.colorMode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.classList.remove("font-sans", "font-serif");
    root.classList.add(prefs.fontFamily === "serif" ? "font-serif" : "font-sans");
    root.dataset.font = prefs.fontFamily === "serif" ? "serif" : "sans";
    root.dataset.theme = prefs.colorMode === "dark" ? "dark" : "light";
    root.dataset.contrast = prefs.highContrast ? "high" : "normal";
    if (prefs.highContrast) root.classList.add("high-contrast");
    else root.classList.remove("high-contrast");
    var scale = prefs.fontScale === "lg" || prefs.fontScale === "xl" ? prefs.fontScale : "md";
    root.dataset.fontScale = scale;
    var px = scale === "xl" ? "22px" : scale === "lg" ? "19px" : "17px";
    root.style.setProperty("--app-font-size", px);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${sourceSerif.variable} font-sans`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <TooltipProvider delay={300}>
            <AuthGate>{children}</AuthGate>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
