import type { Metadata } from "next";
import { Hourglass, SearchX } from "lucide-react";
import { Card, CardContent, EmptyState } from "@vbph/ui";
import { getVaApprovalStatus } from "@/server/queries/va/context";
import { getVaJobFilterOptions, getVaJobs, type VaJobFilters } from "@/server/queries/va/jobs";
import { JobMarketplaceFilters } from "@/components/va/job-marketplace-filters";
import { VaJobCard } from "@/components/va/va-job-card";

export const metadata: Metadata = { title: "Job Marketplace — Virtual Bridge PH" };

type SearchParams = {
  q?: string;
  skill?: string | string[];
  minRate?: string;
  maxRate?: string;
  minHours?: string;
  maxHours?: string;
  timezone?: string;
};

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseFilters(params: SearchParams): VaJobFilters {
  const skills = params.skill ? (Array.isArray(params.skill) ? params.skill : [params.skill]) : [];
  return {
    q: params.q,
    skills,
    minRate: toNumber(params.minRate),
    maxRate: toNumber(params.maxRate),
    minHours: toNumber(params.minHours),
    maxHours: toNumber(params.maxHours),
    timezone: params.timezone,
  };
}

const PENDING_MESSAGE = {
  title: "Your profile is awaiting approval",
  body: "Once our team reviews and approves your profile, you'll be able to browse and apply to open jobs here.",
};

const APPROVAL_MESSAGE: Record<string, { title: string; body: string }> = {
  pending: PENDING_MESSAGE,
  rejected: {
    title: "Your profile wasn't approved",
    body: "Contact Virtual Bridge PH support if you'd like to discuss your application.",
  },
  suspended: {
    title: "Your account is suspended",
    body: "Contact Virtual Bridge PH support for more information.",
  },
};

export default async function VaJobMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const approvalStatus = await getVaApprovalStatus();

  if (approvalStatus !== "approved") {
    const message = APPROVAL_MESSAGE[approvalStatus] ?? PENDING_MESSAGE;
    return (
      <Card>
        <EmptyState icon={Hourglass} title={message.title} description={message.body} />
      </Card>
    );
  }

  const params = await searchParams;
  const filters = parseFilters(params);

  const [jobs, filterOptions] = await Promise.all([getVaJobs(filters), getVaJobFilterOptions()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Job Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Browse open roles from clients on Virtual Bridge PH.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <Card>
            <CardContent className="p-5">
              <JobMarketplaceFilters
                skillOptions={filterOptions.skills}
                timezoneOptions={filterOptions.timezones}
              />
            </CardContent>
          </Card>
        </aside>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {jobs.length} open job{jobs.length === 1 ? "" : "s"}
          </p>
          {jobs.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="No jobs match your filters"
                description="Try broadening your search or clearing a few filters."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {jobs.map((job) => (
                <VaJobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
