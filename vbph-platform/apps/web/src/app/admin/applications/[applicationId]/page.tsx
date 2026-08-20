import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getAdminApplicationDetail, getAdminNotes } from "@/server/queries/admin/applications";
import { ApplicationStatusBadge } from "@/components/shared/application-status-badge";
import { AdminNoteForm } from "@/components/admin/admin-note-form";
import { ApplicationStatusForm } from "@/components/admin/application-status-form";

export const metadata: Metadata = { title: "Application — Virtual Bridge PH" };

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const application = await getAdminApplicationDetail(applicationId);
  if (!application) {
    notFound();
  }

  const notes = await getAdminNotes(applicationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/applications" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Applications
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar src={application.vaAvatarUrl} name={application.vaFullName} size={48} />
              <div>
                <CardTitle>{application.vaFullName}</CardTitle>
                {application.vaHeadline ? (
                  <p className="text-sm text-muted-foreground">{application.vaHeadline}</p>
                ) : null}
              </div>
            </div>
            <ApplicationStatusBadge status={application.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Job</dt>
              <dd className="font-medium text-foreground">{application.jobTitle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="font-medium text-foreground">{application.companyName}</dd>
            </div>
            {application.vaExperienceYears != null ? (
              <div>
                <dt className="text-muted-foreground">Experience</dt>
                <dd className="font-medium text-foreground">{application.vaExperienceYears} yrs</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Applied</dt>
              <dd className="font-medium text-foreground">
                {new Date(application.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>

          {application.vaSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {application.vaSkills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          ) : null}

          <div className="flex gap-4 text-sm">
            {application.vaResumeUrl ? (
              <a href={application.vaResumeUrl} target="_blank" rel="noreferrer" className="text-link hover:underline">
                Resume
              </a>
            ) : null}
            {application.vaPortfolioUrl ? (
              <a href={application.vaPortfolioUrl} target="_blank" rel="noreferrer" className="text-link hover:underline">
                Portfolio
              </a>
            ) : null}
          </div>

          {application.coverNote ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Cover Message</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{application.coverNote}</p>
            </div>
          ) : null}
          {application.relevantExperience ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Relevant Experience</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                {application.relevantExperience}
              </p>
            </div>
          ) : null}
          {application.expectedAvailability ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Expected Availability</h3>
              <p className="mt-1 text-sm text-foreground">{application.expectedAvailability}</p>
            </div>
          ) : null}
          {application.notes ? (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Additional Notes (from VA)</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{application.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status & Placement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApplicationStatusForm applicationId={application.id} status={application.status} />
          {application.status === "HIRED" ? (
            <div>
              <Link
                href={`/admin/placements/new?clientId=${application.clientId}&vaId=${application.vaId}&jobId=${application.jobId}`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
              >
                Create Placement
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Mark this application HIRED to create a placement for it.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Notes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Visible to admins only — never shown to the client or the VA.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AdminNoteForm applicationId={application.id} />
          {notes.length > 0 ? (
            <ul className="flex flex-col gap-3 border-t border-border pt-4">
              {notes.map((note) => (
                <li key={note.id} className="text-sm">
                  <p className="whitespace-pre-line text-foreground">{note.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.authorName ?? "Unknown admin"} ·{" "}
                    {new Date(note.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
