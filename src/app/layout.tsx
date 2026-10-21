import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
// Fonts are bundled locally (no network needed) and shared with the print view.
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import "@/components/worksheets/worksheet.css";
import { ClientMessages } from "@/components/layout/client-messages";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: "Santos Studio", template: "%s · Santos Studio" },
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="dark h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider>
          <ClientMessages />
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
