import Link from "next/link";
import { Avatar, Badge, Card, CardContent, type BadgeProps } from "@vbph/ui";
import type { TeamMemberCard as TeamMemberCardData } from "@/server/queries/client/team";

const STATUS_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  PENDING: "default",
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "default",
};

export function TeamMemberCard({ member }: { member: TeamMemberCardData }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <Avatar src={member.avatarUrl} name={member.fullName} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{member.fullName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {member.headline ?? "No position set"}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[member.status] ?? "default"}>{member.status}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Project</dt>
            <dd className="truncate font-medium text-foreground">
              {member.projectName ?? "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Your rate</dt>
            <dd className="font-medium tabular-nums text-foreground">
              ${member.clientHourlyRate.toFixed(2)}/hr
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Weekly hours</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {member.weeklyHoursExpected ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tracked this week</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {member.hoursTrackedThisWeek.toFixed(1)} hrs
            </dd>
          </div>
        </dl>

        <div className="flex gap-2 pt-1">
          {member.projectId ? (
            <Link
              href={`/client/projects/${member.projectId}`}
              className="flex-1 rounded-md border border-input px-3 py-1.5 text-center text-sm font-medium hover:bg-muted"
            >
              View Project
            </Link>
          ) : null}
          <Link
            href={
              member.projectId
                ? `/client/projects/${member.projectId}/work-diary`
                : `/client/va/${member.vaId}/diary`
            }
            className="flex-1 rounded-md border border-input px-3 py-1.5 text-center text-sm font-medium hover:bg-muted"
          >
            View Work Diary
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
