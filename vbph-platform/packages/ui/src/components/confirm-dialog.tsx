"use client";

import * as React from "react";
import { Modal } from "./modal";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** May return a Promise — the dialog shows its own pending state and stays open until it resolves, then closes. Let it throw/reject to keep the dialog open with `error` set by the caller. */
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button destructive-red and the icon accordingly — for anything that deletes, voids, or otherwise can't be casually undone. */
  danger?: boolean;
  /** Surfaced above the actions, e.g. a failed action's error message. */
  error?: string | null;
}

/**
 * Replaces the browser's native `confirm()` everywhere in this app —
 * `confirm()` blocks the entire tab, can't be styled, isn't announced
 * consistently by screen readers, and (on some platforms) can be
 * suppressed by a "prevent this page from creating additional dialogs"
 * checkbox after the first one, silently turning every future
 * confirmation into an unconditional yes. This is a real modal: focus is
 * trapped, Escape/backdrop/Cancel all decline, and Enter on the confirm
 * button (its default focus target) accepts.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  error,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} title={title} className="max-w-md">
      {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? "destructive" : "primary"}
          size="sm"
          onClick={handleConfirm}
          loading={pending}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
