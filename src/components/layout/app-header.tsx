"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, FolderOpen, Printer, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/santos", key: "library", icon: BookOpen },
  { href: "/crear-fichas", key: "builder", icon: Printer },
  { href: "/colecciones", key: "collections", icon: FolderOpen },
  { href: "/configuracion", key: "settings", icon: Settings },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 print:hidden">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/santos" className="flex items-center gap-2 font-heading text-[1.05rem] font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-md border text-sm">✝</span>
          Santos Studio
        </Link>
        <nav aria-label={t("ariaLabel")} className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t(key)}</span>
                <span className="sm:hidden">{t(`short.${key}`)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
