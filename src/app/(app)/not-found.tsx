import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold">No encontrado</h1>
      <p className="text-sm text-muted-foreground">Esta página o registro no existe o fue eliminado.</p>
      <Button asChild>
        <Link href="/santos">Volver a la biblioteca</Link>
      </Button>
    </div>
  );
}
