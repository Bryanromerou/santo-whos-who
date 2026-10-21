"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** When set, the user must type this word to enable the confirm button. */
  requireText?: string;
  onConfirm: () => Promise<void> | void;
};

/** Confirmation for destructive actions. Stays open (with spinner) until the action finishes. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, requireText, onConfirm }: Props) {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const blocked = !!requireText && typed.trim().toUpperCase() !== requireText.toUpperCase();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireText && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              {t.rich("typeToConfirm", { word: requireText, strong: (chunks) => <strong>{chunks}</strong> })}
            </Label>
            <Input id="confirm-text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || blocked}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                setTyped("");
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
