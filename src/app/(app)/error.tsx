"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <AlertTriangle className="size-10 text-destructive" aria-hidden />
      <h1 className="font-heading text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">{error.message || "Error inesperado al cargar esta página."}</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
