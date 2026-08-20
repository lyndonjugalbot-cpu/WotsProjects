import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Avatar, Badge, Card, CardContent, EmptyState } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getClientJob } from "@/server/queries/client/jobs";
import { getJobApplicants } from "@/server/queries/client/applicants";
import { ApplicationStatusBadge } from "@/components/shared/application-status-badge";

export const metadata: Metadata = { title: "Applicants — Virtual Bridge PH" };

export default async function JobApplicantsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { clientId } = await getClientContext();

  const job = await getClientJob(clientId, jobId);
  if (!job) {
    notFound();
  }

  const applicants = await getJobApplicants(clientId, jobId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/client/jobs/${jobId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to {job.title}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Applicants</h1>
        <p className="text-sm text-muted-foreground">
          {applicants.length} applicant{applicants.length === 1 ? "" : "s"} for {job.title}
        </p>
      </div>

      {applicants.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No applicants yet" description="Applications for this job will show up here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {applicants.map((applicant) => (
            <Card key={applicant.applicationId}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={applicant.vaAvatarUrl} name={applicant.vaFullName} size={44} />
                    <div>
                      <p className="font-medium text-foreground">{applicant.vaFullName}</p>
                      {applicant.vaHeadline ? (
                        <p className="text-sm text-muted-foreground">{applicant.vaHeadline}</p>
                      ) : null}
                    </div>
                  </div>
                  <ApplicationStatusBadge status={applicant.status} />
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                  {applicant.vaExperienceYears != null ? (
                    <div>
                      <dt>Experience</dt>
                      <dd className="font-medium text-foreground">{applicant.vaExperienceYears} yrs</dd>
                    </div>
                  ) : null}
                  {applicant.expectedAvailability ? (
                    <div>
                      <dt>Availability</dt>
                      <dd className="font-medium text-foreground">{applicant.expectedAvailability}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Applied</dt>
                    <dd className="font-medium text-foreground">
                      {new Date(applicant.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </dd>
                  </div>
                  {applicant.vaResumeUrl ? (
                    <div>
                      <dt>Resume</dt>
                      <dd>
                        <a
                          href={applicant.vaResumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-link hover:underline"
                        >
                          View
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {applicant.vaSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {applicant.vaSkills.map((skill) => (
                      <Badge key={skill}>{skill}</Badge>
                    ))}
                  </div>
                ) : null}

                {applicant.coverNote ? (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">Cover Message</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{applicant.coverNote}</p>
                  </div>
                ) : null}

                {applicant.relevantExperience ? (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">Relevant Experience</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                      {applicant.relevantExperience}
                    </p>
                  </div>
                ) : null}

                {applicant.notes ? (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">Additional Notes</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{applicant.notes}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
