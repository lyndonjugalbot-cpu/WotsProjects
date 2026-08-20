"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button, Input, Label, Select, cn } from "@vbph/ui";

export interface JobMarketplaceFiltersProps {
  skillOptions: string[];
  timezoneOptions: string[];
}

export function JobMarketplaceFilters({ skillOptions, timezoneOptions }: JobMarketplaceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(searchParams.getAll("skill"));
  const [minRate, setMinRate] = useState(searchParams.get("minRate") ?? "");
  const [maxRate, setMaxRate] = useState(searchParams.get("maxRate") ?? "");
  const [minHours, setMinHours] = useState(searchParams.get("minHours") ?? "");
  const [maxHours, setMaxHours] = useState(searchParams.get("maxHours") ?? "");
  const [timezone, setTimezone] = useState(searchParams.get("timezone") ?? "");

  const activeFilterCount =
    (q ? 1 : 0) +
    selectedSkills.length +
    (minRate ? 1 : 0) +
    (maxRate ? 1 : 0) +
    (minHours ? 1 : 0) +
    (maxHours ? 1 : 0) +
    (timezone ? 1 : 0);

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    for (const skill of selectedSkills) params.append("skill", skill);
    if (minRate) params.set("minRate", minRate);
    if (maxRate) params.set("maxRate", maxRate);
    if (minHours) params.set("minHours", minHours);
    if (maxHours) params.set("maxHours", maxHours);
    if (timezone) params.set("timezone", timezone);
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  function clearFilters() {
    setQ("");
    setSelectedSkills([]);
    setMinRate("");
    setMaxRate("");
    setMinHours("");
    setMaxHours("");
    setTimezone("");
    router.push(pathname);
  }

  return (
    <form onSubmit={applyFilters} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          placeholder="Job title, description, responsibilities…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minRate">Min rate ($/hr)</Label>
          <Input
            id="minRate"
            type="number"
            min={0}
            step={0.5}
            value={minRate}
            onChange={(e) => setMinRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxRate">Max rate ($/hr)</Label>
          <Input
            id="maxRate"
            type="number"
            min={0}
            step={0.5}
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minHours">Min hrs/week</Label>
          <Input
            id="minHours"
            type="number"
            min={1}
            step={1}
            value={minHours}
            onChange={(e) => setMinHours(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxHours">Max hrs/week</Label>
          <Input
            id="maxHours"
            type="number"
            min={1}
            step={1}
            value={maxHours}
            onChange={(e) => setMaxHours(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="">Any timezone</option>
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </div>

      {skillOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label>Skills</Label>
          <div className="flex flex-wrap gap-1.5">
            {skillOptions.map((skill) => {
              const active = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "border-primary/40 bg-primary-soft text-primary-soft-foreground"
                      : "border-input text-muted-foreground hover:bg-muted"
                  )}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Search
        </Button>
        {activeFilterCount > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
