import type { Metadata } from "next";
// Fonts are bundled locally (no network needed) and shared with the print view.
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import "@/components/worksheets/worksheet.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Santos Studio", template: "%s · Santos Studio" },
  description: "Biblioteca de santos y fichas imprimibles para el grupo juvenil.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="dark h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
