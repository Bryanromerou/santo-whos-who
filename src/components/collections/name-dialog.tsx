"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
};

/** Small dialog to create or rename a collection. Keeps the typed name if saving fails. */
export function NameDialog({ open, onOpenChange, title, description, initialName = "", submitLabel, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <NameForm key={initialName} {...{ title, description, initialName, submitLabel, onSubmit, onOpenChange }} />}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({ title, description, initialName, submitLabel, onSubmit, onOpenChange }: Omit<Props, "open">) {
  const [name, setName] = useState(initialName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Escribe un nombre.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await onSubmit(name.trim());
          onOpenChange(false);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="collection-name">Nombre</Label>
        <Input id="collection-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} aria-invalid={!!error} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
