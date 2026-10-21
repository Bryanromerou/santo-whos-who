"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Importer } from "./importer";
import { JsonFormatReference, JsonFormatSummary } from "./json-format-help";

/** «Importar JSON» as a modal: upload + preview on one tab, the file format on the other. */
export function ImportJsonDialog({ trigger, seedAvailable }: { trigger: ReactNode; seedAvailable: boolean }) {
  const router = useRouter();
  const t = useTranslations("import.dialog");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("subir");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTab("subir");
          router.refresh();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="subir">{t("uploadTab")}</TabsTrigger>
            <TabsTrigger value="formato">{t("formatTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="subir" className="space-y-6 pt-4">
            <JsonFormatSummary onShowFull={() => setTab("formato")} />
            {/* Keep the importer mounted while switching tabs so the chosen file isn't lost. */}
          </TabsContent>
          <div className={tab === "subir" ? "pt-2" : "hidden"}>
            <Importer seedAvailable={seedAvailable} autoSeed={false} onClose={() => setOpen(false)} />
          </div>
          <TabsContent value="formato" className="pt-4">
            <JsonFormatReference />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
