import Image from "next/image";

const VALUE_PROPS = [
  "Vetted, approved VAs — every rate calculated server-side",
  "Full visibility into hours, screenshots, and invoices",
  "One platform for clients, VAs, and your team",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Branded panel — hidden on small screens, where the logo in the
          form column below is enough. */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-secondary p-12 text-secondary-foreground lg:flex">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent/20"
        />

        <Image
          src="/brand/logo-full.png"
          alt="Virtual Bridge PH"
          width={280}
          height={70}
          priority
          className="relative z-10 h-auto w-56"
        />

        <div className="relative z-10 flex flex-col gap-6">
          <p className="text-2xl font-semibold leading-snug">
            Bridging the gap between great teams and great talent.
          </p>
          <ul className="flex flex-col gap-3">
            {VALUE_PROPS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-secondary-foreground/90">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-secondary-foreground/70">
          © {new Date().getFullYear()} Virtual Bridge PH
        </p>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
        <Image
          src="/brand/logo-full.png"
          alt="Virtual Bridge PH"
          width={220}
          height={55}
          priority
          className="h-auto w-44 lg:hidden"
        />
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
