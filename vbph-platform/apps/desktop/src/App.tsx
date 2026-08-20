import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "./lib/authStore";
import { usePlacementsStore } from "./lib/placementsStore";
import { useTimerStore } from "./lib/timerStore";
import { useTotalsStore } from "./lib/totals";
import { startBackgroundSync } from "./lib/offlineQueue";
import { LoginScreen } from "./screens/LoginScreen";
import { ProjectSelectionScreen } from "./screens/ProjectSelectionScreen";
import { TimerScreen } from "./screens/TimerScreen";

export default function App() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const logout = useAuthStore((s) => s.logout);

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap]);

  // Once signed in: load this VA's ACTIVE placements, reconcile any
  // in-flight timer against the server (crash/restart recovery), get an
  // initial Today/Week reading, and start retrying the offline queue in
  // the background. Runs once per sign-in, not on every render.
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "signed-in" || !profile) return;
    if (initializedFor.current === profile.id) return;
    initializedFor.current = profile.id;

    const stopSync = startBackgroundSync();

    (async () => {
      await usePlacementsStore.getState().fetch();
      await useTimerStore.getState().reconcile();
      if (!useTimerStore.getState().placementId) {
        await usePlacementsStore.getState().restoreLastSelection();
      }
      await useTotalsStore.getState().refresh();
    })();

    return stopSync;
  }, [status, profile]);

  if (status === "checking") {
    return (
      <div className="app-shell">
        <div className="centered">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (status === "offline-locked") {
    return (
      <div className="app-shell">
        <div className="centered">
          <div className="card stack" style={{ maxWidth: 320 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>You're offline</h2>
            <p className="muted" style={{ margin: 0 }}>
              We couldn't verify your saved sign-in without an internet connection. Reconnect and try again.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => void bootstrap()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <div className="app-shell">
        <LoginScreen />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__title">Virtual Bridge PH Time Tracker</span>
        <span className="app-header__user">
          {profile?.fullName}
          <SignOutButton logout={logout} />
        </span>
      </header>
      <MainScreen />
    </div>
  );
}

/**
 * Signing out while a timer is running would otherwise orphan it:
 * nothing else ever clears timerStore's interval on logout, so its
 * capture scheduling and API calls would keep running with no signed-in
 * user behind them — exactly what "never capture screenshots while
 * logged out" rules out. Stopping first (syncing the final segment and
 * ending the session properly) is what actually guarantees that,
 * instead of merely hiding the symptom.
 */
function SignOutButton({ logout }: { logout: (reason?: string) => Promise<void> }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (useTimerStore.getState().status === "running") {
        await useTimerStore.getState().stop();
      }
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <button type="button" className="app-header__signout" onClick={() => void handleSignOut()} disabled={signingOut}>
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

function MainScreen() {
  const timerPlacementId = useTimerStore((s) => s.placementId);
  const selectedPlacementId = usePlacementsStore((s) => s.selectedPlacementId);
  const placementId = timerPlacementId ?? selectedPlacementId;
  return placementId ? <TimerScreen /> : <ProjectSelectionScreen />;
}
