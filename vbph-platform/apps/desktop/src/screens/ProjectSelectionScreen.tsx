import { useEffect } from "react";
import { usePlacementsStore } from "../lib/placementsStore";
import { useAuthStore } from "../lib/authStore";

export function ProjectSelectionScreen() {
  const { placements, loading, error, fetch, select } = usePlacementsStore();
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return (
    <div className="app-body">
      <div>
        <h2 style={{ margin: "0 0 2px", fontSize: 15, color: "var(--color-navy)" }}>
          Hi {profile?.fullName ?? "there"}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Select a project to start tracking time
        </p>
      </div>

      {loading ? (
        <div className="centered">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="card stack">
          <p className="error-text">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void fetch()}>
            Retry
          </button>
        </div>
      ) : placements.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            You don't have any active placements right now. Once one is activated, it'll show up here.
          </p>
        </div>
      ) : (
        <div className="placement-list">
          {placements.map((p) => (
            <button
              key={p.id}
              type="button"
              className="placement-card"
              onClick={() => void select(p.id)}
            >
              <div className="placement-card__company">{p.companyName}</div>
              <div className="placement-card__project">
                {p.projectName ?? "No project set"}
                {p.jobTitle ? ` · ${p.jobTitle}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
