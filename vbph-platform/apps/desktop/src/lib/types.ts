// Mirrors the JSON shapes returned by apps/web/src/app/api/time/*
// (see MyProfileDto / VaPlacementSummaryDto / TimeSessionDto /
// TimeSegmentDto in apps/web/src/server/time-tracking/service.ts).
// Hand-declared rather than imported from a shared package: this app
// only ever talks to the backend over HTTP, never imports its server
// code, so there's nothing to keep type-identical beyond "the JSON
// actually looks like this."

export interface MyProfile {
  id: string;
  fullName: string | null;
  role: string;
  status: string;
}

export interface VaPlacementSummary {
  id: string;
  companyName: string;
  projectId: string | null;
  projectName: string | null;
  jobTitle: string | null;
  hoursPerWeekExpected: number | null;
  startDate: string;
}

export interface TimeSession {
  id: string;
  vaId: string;
  placementId: string;
  projectId: string | null;
  projectName: string | null;
  startTime: string;
  endTime: string | null;
  totalTimeSeconds: number;
  status: string;
}

export interface TimeSegment {
  id: string;
  timeEntryId: string;
  segmentStart: string;
  segmentEnd: string;
  durationSeconds: number;
  keyboardActivityCount: number | null;
  mouseActivityCount: number | null;
  activityPercentage: number | null;
  memo: string | null;
  screenshotUrl: string | null;
}
