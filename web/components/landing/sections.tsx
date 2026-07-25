import Link from "next/link";
import { ArrowRight, CheckCircle2, FolderKanban, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";

function HeroStage() {
  return (
    <div className="relative mt-14 w-full animate-fade-up" style={{ animationDelay: "280ms" }}>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-t-[1.75rem] border border-b-0 border-slate-200/80 bg-white shadow-[0_-20px_60px_rgba(29,78,216,0.08)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_-20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <p className="ml-3 text-xs font-medium text-muted-foreground">Product Launch · Workspace</p>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              title: "Finalize onboarding copy",
              meta: "In Progress · High",
              tone: "border-l-sky-500",
            },
            {
              title: "Design dashboard widgets",
              meta: "Todo · Medium",
              tone: "border-l-amber-500",
            },
            {
              title: "Invite core team members",
              meta: "Done · Low",
              tone: "border-l-emerald-500",
            },
          ].map((task) => (
            <div
              key={task.title}
              className={`border-t border-slate-100 px-5 py-6 dark:border-slate-800 md:border-l md:border-t-0 ${task.tone} border-l-4`}
            >
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">{task.meta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-[100svh] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#eef5ff] via-[#fbfcfe] to-[#fff5f7] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" />
      <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" />
      <div className="absolute -right-24 top-24 h-[26rem] w-[26rem] rounded-full bg-rose-300/25 blur-3xl dark:bg-rose-500/10" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-6 pb-0 pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-fade-up font-display text-5xl font-semibold tracking-tight text-brand-gradient sm:text-6xl md:text-7xl">
            TeamSync
          </p>
          <h1
            className="animate-fade-up mt-5 text-2xl font-medium leading-snug text-slate-800 dark:text-slate-100 sm:text-3xl"
            style={{ animationDelay: "110ms" }}
          >
            Collaborate. Chat. Stay in Sync.
          </h1>
          <p
            className="animate-fade-up mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animationDelay: "200ms" }}
          >
            Create workspaces, manage tasks, and keep your team aligned in one clean
            collaboration space.
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "290ms" }}
          >
            <Button asChild size="lg" className="group">
              <Link href="/signup">
                Start free
                <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <HeroStage />
      </div>
    </section>
  );
}

const features = [
  {
    icon: FolderKanban,
    title: "Workspace-first organization",
    description:
      "Group projects into dedicated workspaces so every task stays where it belongs.",
    iconClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    icon: CheckCircle2,
    title: "Clear task management",
    description:
      "Track status, priority, and due dates with a board that stays easy to scan.",
    iconClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  {
    icon: ShieldCheck,
    title: "Secure authentication",
    description:
      "Sign up, log in, and manage sessions with production-ready Supabase Auth.",
    iconClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    icon: Sparkles,
    title: "Built for focus",
    description:
      "A calm interface with light and dark modes designed for everyday teamwork.",
    iconClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Features</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to stay aligned
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Authenticate, create workspaces, and manage tasks without visual clutter.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delayMs={index * 90}>
                <div className="group">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${feature.iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section id="cta" className="pb-24 pt-8">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.75rem] bg-slate-900 px-8 py-16 text-white sm:px-14">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-rose-500/20 via-blue-500/15 to-transparent" />
            <div className="relative max-w-xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to keep your team in sync?
              </h2>
              <p className="mt-4 text-slate-300">
                Create your workspace in minutes and start organizing work with a clean,
                professional workflow.
              </p>
              <div className="mt-8">
                <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-blue-50">
                  <Link href="/signup">Create your account</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold">TeamSync</p>
          <p className="text-sm text-muted-foreground">Collaborate. Chat. Stay in Sync.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} TeamSync. Built for focused collaboration.
        </p>
      </div>
    </footer>
  );
}
