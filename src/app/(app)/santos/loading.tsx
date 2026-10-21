import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const t = await getTranslations("library");
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-8 sm:px-6" aria-busy="true" aria-label={t("loading")}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
