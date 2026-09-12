import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import {
  parseSidebarCookie,
  SIDEBAR_COOKIE,
} from "@/components/layout/sidebar-cookie";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Orbit Design System — Fundação Visual",
  description:
    "Fundação do design system do Orbit Operations ERP: tokens, componentes, layout e motion.",
  openGraph: {
    title: "Orbit Design System — Fundação Visual",
    description:
      "Tokens, biblioteca de componentes e layout base da plataforma Orbit.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  /**
   * A preferência de menu é lida **no servidor**.
   *
   * É o que faz o primeiro quadro sair com a largura certa. Lida só no
   * cliente, a barra renderizaria expandida no HTML e encolheria na
   * hidratação — que era exatamente o piscar a cada navegação.
   */
  const store = await cookies();
  const sidebarCollapsed = parseSidebarCookie(
    store.get(SIDEBAR_COOKIE)?.value,
  );

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <Providers sidebarCollapsed={sidebarCollapsed}>{children}</Providers>
      </body>
    </html>
  );
}
