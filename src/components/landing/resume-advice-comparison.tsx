import Image from "next/image";
import {
  Award,
  Bot,
  CalendarDays,
  Check,
  FileText,
  ShieldCheck,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "blue" | "mint" | "neutral";

function toneClasses(tone: Tone) {
  if (tone === "mint") {
    return {
      card: "border-[rgba(45,189,139,0.28)] bg-[linear-gradient(180deg,#f7fffb_0%,#fff_100%)]",
      icon: "border-[rgba(45,189,139,0.28)] bg-[var(--tm-mint-50)] text-[var(--tm-mint-600)]",
    };
  }

  if (tone === "blue") {
    return {
      card: "border-[rgba(67,115,219,0.18)] bg-white",
      icon: "border-[var(--tm-blue-100)] bg-[var(--tm-blue-50)] text-[var(--tm-blue-600)]",
    };
  }

  return {
    card: "border-[var(--tm-border)] bg-white",
    icon: "border-[var(--tm-border)] bg-white text-[var(--tm-blue-600)]",
  };
}

function IconBadge({
  icon: Icon,
  tone = "blue",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const classes = toneClasses(tone);
  const sizeClass =
    size === "lg"
      ? "h-11 w-11 rounded-full"
      : size === "sm"
        ? "h-7 w-7 rounded-full"
        : "h-9 w-9 rounded-lg";

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center border ${classes.icon}`}
      aria-hidden="true"
    >
      <Icon size={size === "lg" ? 20 : size === "sm" ? 14 : 17} strokeWidth={1.8} />
    </span>
  );
}

function Card({
  tone,
  children,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const classes = toneClasses(tone);

  return (
    <article className={`rounded-lg border p-5 shadow-[0_10px_26px_rgba(24,24,27,0.035)] ${classes.card} ${className}`}>
      {children}
    </article>
  );
}

function BulletItem({
  icon: Icon,
  children,
  tone,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  tone: "positive" | "negative";
}) {
  const iconClass =
    tone === "positive"
      ? "bg-[var(--tm-mint-50)] text-[var(--tm-mint-600)]"
      : "bg-[var(--tm-blue-50)] text-[var(--tm-blue-600)]";

  return (
    <li className="flex items-center gap-2.5 text-[13.5px] text-[var(--tm-slate)]">
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        aria-hidden="true"
      >
        <Icon size={13} strokeWidth={2} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function CredentialItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 border-t border-[var(--tm-border)] pt-3 text-[12px] text-[var(--tm-slate)] md:border-l md:border-t-0 md:pl-4 md:pt-0">
      <IconBadge icon={Icon} tone="neutral" size="sm" />
      <span className="leading-snug">{label}</span>
    </li>
  );
}

export default function ResumeAdviceComparison({
  headshotSrc = "/michael.png",
}: {
  headshotSrc?: string;
}) {
  return (
    <section className="tm-sec" aria-labelledby="resume-advice-comparison-title">
      <div className="tm-wrap">
        <header className="mx-auto max-w-[760px] text-center">
          <h2
            id="resume-advice-comparison-title"
            className="tm-h2 mx-auto max-w-[23ch]"
          >
            Why this is not generic AI resume advice
          </h2>
          <p className="tm-body mx-auto mt-[10px] max-w-[68ch]">
            Specialist agents plus certified resume writer judgment, grounded in
            ATS standards, recruiter scan patterns, and the role you are actually
            targeting.
          </p>
        </header>

        <div className="relative mt-7 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Card tone="blue">
            <div className="flex items-center gap-3">
              <IconBadge icon={Bot} tone="blue" size="lg" />
              <h3 className="text-[21px] font-medium leading-tight text-[var(--tm-ink)]">
                Generic AI
              </h3>
            </div>
            <div className="my-4 h-px bg-[var(--tm-border)]" />
            <ul className="space-y-3">
              <BulletItem icon={X} tone="negative">
                Broad suggestions
              </BulletItem>
              <BulletItem icon={X} tone="negative">
                No ATS context
              </BulletItem>
              <BulletItem icon={X} tone="negative">
                No role targeting
              </BulletItem>
            </ul>
          </Card>

          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tm-border)] bg-white text-[13px] font-semibold text-[var(--tm-ink)] shadow-[0_8px_18px_rgba(24,24,27,0.07)] md:mx-0">
            vs.
          </div>

          <Card tone="mint">
            <div className="flex items-center gap-3">
              <IconBadge icon={Check} tone="mint" size="lg" />
              <h3 className="text-[21px] font-medium leading-tight text-[var(--tm-ink)]">
                TailorMe
              </h3>
            </div>
            <div className="my-4 h-px bg-[var(--tm-border)]" />
            <ul className="space-y-3">
              <BulletItem icon={Check} tone="positive">
                ATS standards
              </BulletItem>
              <BulletItem icon={Check} tone="positive">
                Recruiter scan patterns
              </BulletItem>
              <BulletItem icon={Check} tone="positive">
                Role-fit scoring
              </BulletItem>
              <BulletItem icon={Check} tone="positive">
                Optional human pass
              </BulletItem>
            </ul>
          </Card>
        </div>

        <aside className="mt-5 rounded-lg border border-[var(--tm-border)] bg-white p-4 shadow-[0_10px_26px_rgba(24,24,27,0.035)]" aria-label="Certified resume writer credentials">
          <div className="grid gap-4 md:grid-cols-[minmax(190px,0.72fr)_1fr] md:items-center">
            <div className="flex items-center gap-3">
              <Image
                src={headshotSrc}
                alt="Michael, certified professional resume writer"
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-full border border-[var(--tm-border)] object-cover"
              />
              <div>
                <h3 className="text-[18px] font-medium leading-tight text-[var(--tm-ink)]">
                  Michael
                </h3>
                <p className="mt-1 text-[13px] leading-snug text-[var(--tm-zinc)]">
                  Certified Professional Resume Writer
                </p>
              </div>
            </div>

            <ul className="grid gap-3 md:grid-cols-4">
              <CredentialItem icon={Award} label="Certified Professional Resume Writer" />
              <CredentialItem icon={CalendarDays} label="15+ years of experience" />
              <CredentialItem icon={FileText} label="650+ resumes written" />
              <CredentialItem icon={Star} label="Fiverr Top Rated Pro, 4.8/5 across 200+ reviews" />
            </ul>
          </div>
        </aside>

        <footer className="mt-5 flex items-center justify-center gap-2.5 rounded-lg border border-[var(--tm-border)] bg-white px-5 py-3 text-center text-[13.5px] text-[var(--tm-slate)]">
          <IconBadge icon={ShieldCheck} tone="blue" size="sm" />
          <p>
            Built on ATS standards, recruiter scan patterns, and certified
            professional resume writer opinion.
          </p>
        </footer>
      </div>
    </section>
  );
}
