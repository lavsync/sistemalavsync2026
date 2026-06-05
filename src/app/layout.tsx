import type { Metadata } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Brandbook §04: Inter = corpo / UI · Sora = títulos / KPIs / wordmark / CTA
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LavSync · Tudo da sua lavanderia. Sincronizado.",
  description:
    "A plataforma de gestão inteligente que sincroniza todas as dimensões do seu negócio em um único painel de controle. Construída especificamente para lavanderias de autosserviço e redes de franquias.",
  applicationName: "LavSync",
  keywords: [
    "LavSync",
    "lavanderia autosserviço",
    "gestão de lavanderia",
    "SaaS lavanderia",
    "dashboard lavanderia",
    "MAXPAN integração",
    "franquia lavanderia",
  ],
  authors: [{ name: "LavSync" }],
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "LavSync · Tudo da sua lavanderia. Sincronizado. Inteligente. Lucrativo.",
    description: "A única plataforma construída de dentro para fora das lavanderias de autosserviço.",
    type: "website",
    locale: "pt_BR",
    siteName: "LavSync",
  },
  twitter: {
    card: "summary_large_image",
    title: "LavSync · Operations OS",
    description: "Tudo da sua lavanderia. Sincronizado. Inteligente. Lucrativo.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
