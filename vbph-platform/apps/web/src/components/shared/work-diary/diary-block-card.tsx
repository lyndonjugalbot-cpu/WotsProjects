"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, CardContent, Modal, ConfirmDialog } from "@vbph/ui";
import type { WorkDiaryBlockDto } from "@/server/time-tracking/service";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
};

export interface DiaryBlockCardProps {
  block: WorkDiaryBlockDto;
  canDelete: boolean;
  deleteAction?: (screenshotId: string) => Promise<{ error: string | null }>;
  confirmMessage: string;
  showVaContext?: boolean;
}

export function DiaryBlockCard({
  block,
  canDelete,
  deleteAction,
  confirmMessage,
  showVaContext,
}: DiaryBlockCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (deleted) return null;

  const time = new Date(block.segmentStart).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  function handleDelete(): Promise<void> {
    if (!deleteAction || !block.screenshotId) return Promise.resolve();
    return new Promise<void>((resolve) => {
      setError(null);
      startTransition(async () => {
        const result = await deleteAction(block.screenshotId!);
        if (result.error) {
          // Left open on failure — ConfirmDialog's `error` prop shows why,
          // and the user can retry without re-opening it from scratch.
          setError(result.error);
        } else {
          setConfirmOpen(false);
          setDeleted(true);
        }
        resolve();
      });
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => block.screenshotUrl && setPreviewOpen(true)}
          disabled={!block.screenshotUrl}
          className="group shrink-0 overflow-hidden rounded-md border border-border bg-muted transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="View screenshot"
        >
          {block.screenshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static/local asset next/image can optimize
            <img
              src={block.screenshotUrl}
              alt=""
              className="h-24 w-40 object-cover transition-transform motion-safe:duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-24 w-40 items-center justify-center text-xs text-muted-foreground">
              No screenshot
            </div>
          )}
        </button>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{time}</span>
              <span className="text-sm text-muted-foreground">{formatDuration(block.durationSeconds)}</span>
              <Badge variant={STATUS_VARIANT[block.entryStatus] ?? "default"} dot>
                {block.entryStatus}
              </Badge>
            </div>
            {canDelete && block.screenshotId ? (
              <Button type="button" size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
                Delete
              </Button>
            ) : null}
          </div>

          {showVaContext ? (
            <p className="text-sm text-muted-foreground">
              {block.vaName}
              {block.clientName ? ` · ${block.clientName}` : ""}
              {block.projectName ? ` · ${block.projectName}` : ""}
            </p>
          ) : null}

          <dl
            className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"
            title="Activity reflects the share of this block with detected keyboard/mouse input — not a measure of productivity, work quality, or effort."
          >
            <div>
              <dt className="inline">Activity: </dt>
              <dd className="inline font-medium text-foreground">
                {block.activityPercentage != null ? `${block.activityPercentage}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline">Keyboard: </dt>
              <dd className="inline font-medium text-foreground">
                {block.keyboardActivityCount != null ? block.keyboardActivityCount : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline">Mouse: </dt>
              <dd className="inline font-medium text-foreground">
                {block.mouseActivityCount != null ? block.mouseActivityCount : "—"}
              </dd>
            </div>
          </dl>

          {block.memo ? <p className="text-sm text-foreground">{block.memo}</p> : null}
        </div>
      </CardContent>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Screenshot">
        {block.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
          <img src={block.screenshotUrl} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          {time} · {formatDuration(block.durationSeconds)}
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this screenshot?"
        description={confirmMessage}
        confirmLabel="Delete"
        danger
        error={error}
      />
    </Card>
  );
}
