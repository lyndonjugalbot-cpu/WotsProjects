import { useEffect, useState } from "react";
import { useTimerStore } from "../lib/timerStore";
import { usePlacementsStore } from "../lib/placementsStore";
import { useTotalsStore } from "../lib/totals";
import { useAuthStore } from "../lib/authStore";
import { useNetworkStore } from "../lib/network";
import { formatClock, formatHours } from "../lib/format";
import { Banner } from "../components/Banner";
import { Modal } from "../components/Modal";
import { getScreenshotDisclosureSeen, setScreenshotDisclosureSeen } from "../lib/localStore";
import { openScreenRecordingSettings, requestScreenRecordingPermission } from "../lib/screenshotCapture";
import { openAccessibilitySettings, requestAccessibilityPermission } from "../lib/activityMonitor";

export function TimerScreen() {
  const timer = useTimerStore();
  const { placements, selectedPlacementId, clearSelection } = usePlacementsStore();
  const totals = useTotalsStore();
  const profile = useAuthStore((s) => s.profile);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const placementId = timer.placementId ?? selectedPlacementId;
  const placement = placements.find((p) => p.id === placementId) ?? null;

  // Local edit buffer so typing feels immediate; setTask() only commits
  // to the store (and persists) on blur. When the store's task changes
  // for a reason OTHER than local typing — e.g. reconcile() resuming a
  // session with its previously-saved task — the buffer needs to catch
  // up. Adjusting state during render (not in an effect) is the pattern
  // React itself recommends for "reset local state when a value from
  // the outside changes": https://react.dev/learn/you-might-not-need-an-effect
  const [taskDraft, setTaskDraft] = useState(timer.task);
  const [lastSyncedTask, setLastSyncedTask] = useState(timer.task);
  if (lastSyncedTask !== timer.task) {
    setLastSyncedTask(timer.task);
    setTaskDraft(timer.task);
  }

  const isRunning = timer.status === "running";
  const isBusy = timer.status === "starting" || timer.status === "stopping";

  // Live seconds accumulated in the not-yet-synced current segment, added
  // on top of the server-confirmed totals — see totals.ts for why this
  // split avoids double counting. Ticked inside timerStore (an effect
  // handler, i.e. a legitimate place for Date.now()), not computed here
  // during render.
  const liveUnsyncedSeconds = isRunning ? timer.liveUnsyncedSeconds : 0;

  useEffect(() => {
    void totals.refresh();
    const interval = setInterval(() => void totals.refresh(), 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whether the one-time screenshot disclosure has been shown before —
  // null while still loading from disk, to avoid a flash of the modal on
  // every screen mount before we actually know.
  const [disclosureSeen, setDisclosureSeen] = useState<boolean | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);
  useEffect(() => {
    void getScreenshotDisclosureSeen().then(setDisclosureSeen);
  }, []);

  function handleStartClick() {
    if (disclosureSeen === false) {
      setShowDisclosure(true);
      return;
    }
    void timer.start(placementId!);
  }

  function acknowledgeDisclosure() {
    setShowDisclosure(false);
    setDisclosureSeen(true);
    void setScreenshotDisclosureSeen(true);
    void timer.start(placementId!);
  }

  if (!placementId) {
    return (
      <div className="centered">
        <p className="muted">No project selected.</p>
      </div>
    );
  }

  return (
    <div className="app-body">
      {showDisclosure ? (
        <Modal>
          <h2 style={{ margin: "0 0 8px", fontSize: 15, color: "var(--color-navy)" }}>Before you start tracking</h2>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--color-text)" }}>
            While a timer is running, this app periodically captures a single screenshot of your primary display —
            roughly once every 10 minutes, at a randomized moment. It also counts keyboard and mouse activity to
            calculate an activity percentage for each 10-minute block.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--color-text)" }}>
            Activity counting never records which keys you press, anything you type, passwords, clipboard content, or
            what you click — only aggregate counts. Activity percentage reflects detected input, not the quality or
            productivity of your work. Both screenshots and activity counting only happen while the timer is actively
            running.
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text)" }}>
            Each screenshot and activity score is linked to you, this client, and this project, and is only visible to{" "}
            {placement?.companyName ?? "this client"} and Virtual Bridge PH staff.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={acknowledgeDisclosure}>
            I understand, start tracking
          </button>
        </Modal>
      ) : null}

      {timer.recoveryNotice ? (
        <Banner kind="warning" onDismiss={timer.clearRecoveryNotice}>
          {timer.recoveryNotice}
        </Banner>
      ) : null}
      {!isOnline ? (
        <Banner kind="info">Offline — your time is still being tracked locally and will sync automatically.</Banner>
      ) : null}
      {timer.screenshotPermissionIssue ? (
        <Banner kind="warning">
          Screen Recording permission is needed to capture screenshots.{" "}
          <button
            type="button"
            className="switch-project"
            style={{ display: "inline", fontSize: 13 }}
            onClick={() => {
              void requestScreenRecordingPermission().then((granted) => {
                if (!granted) void openScreenRecordingSettings();
              });
            }}
          >
            Fix this
          </button>
        </Banner>
      ) : null}
      {timer.activityPermissionIssue ? (
        <Banner kind="warning">
          Accessibility permission is needed to measure keyboard/mouse activity.{" "}
          <button
            type="button"
            className="switch-project"
            style={{ display: "inline", fontSize: 13 }}
            onClick={() => {
              void requestAccessibilityPermission().then((granted) => {
                if (!granted) void openAccessibilitySettings();
              });
            }}
          >
            Fix this
          </button>
        </Banner>
      ) : null}

      <div className="card stack">
        <div className="timer-context">
          <div className="timer-context__item">
            <div className="label">VA Name</div>
            <div className="timer-context__value">{profile?.fullName ?? "—"}</div>
          </div>
          <div className="timer-context__item">
            <div className="label">Client</div>
            <div className="timer-context__value">{placement?.companyName ?? "—"}</div>
          </div>
          <div className="timer-context__item">
            <div className="label">Project</div>
            <div className="timer-context__value">{placement?.projectName ?? "—"}</div>
          </div>
          <div className="timer-context__item">
            <div className="label">Current Task</div>
          </div>
        </div>

        <input
          className="input"
          placeholder="What are you working on?"
          value={taskDraft}
          onChange={(e) => setTaskDraft(e.target.value)}
          onBlur={() => void timer.setTask(taskDraft)}
          disabled={!isRunning}
        />

        <div className={`clock ${isRunning ? "" : "clock--idle"}`}>{formatClock(timer.elapsedSeconds)}</div>

        {isRunning ? (
          <div className="capture-indicator">
            <span className="capture-indicator__dot" />
            <span>Screenshots and keyboard/mouse activity are being recorded while tracking is active</span>
          </div>
        ) : null}

        {timer.error ? <p className="error-text">{timer.error}</p> : null}

        {isRunning ? (
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={isBusy}
            onClick={() => void timer.stop()}
          >
            {timer.status === "stopping" ? "Stopping…" : "STOP"}
          </button>
        ) : (
          <button type="button" className="btn btn-success btn-block" disabled={isBusy} onClick={handleStartClick}>
            {timer.status === "starting" ? "Starting…" : "START"}
          </button>
        )}

        <button
          type="button"
          className="switch-project"
          disabled={isRunning || isBusy}
          onClick={() => void clearSelection()}
        >
          Switch project
        </button>
      </div>

      <div className="totals-row">
        <div className="totals-row__item">
          <div className="totals-row__value">{formatHours(totals.todaySeconds + liveUnsyncedSeconds)}</div>
          <div className="totals-row__label">Today</div>
        </div>
        <div className="totals-row__item">
          <div className="totals-row__value">{formatHours(totals.weekSeconds + liveUnsyncedSeconds)}</div>
          <div className="totals-row__label">This Week</div>
        </div>
      </div>
    </div>
  );
}
