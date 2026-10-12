'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Layers3,
  MessageSquareText,
  Sparkles,
  WandSparkles,
  Workflow,
} from 'lucide-react';

const features = [
  {
    icon: MessageSquareText,
    title: 'Give every task an agent',
    description: 'Create focused assistants with their own instructions, conversation, and workspace.',
    tint: 'bg-blue-50 text-blue-700 ring-blue-100',
  },
  {
    icon: Layers3,
    title: 'Bring your tools together',
    description: 'Connect the apps you already use and let your agents work across them.',
    tint: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    icon: CalendarClock,
    title: 'Keep work moving',
    description: 'Turn repeatable work into scheduled routines and review each run in one place.',
    tint: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[780px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(219,234,254,0.78),transparent_67%)]" />
      <header className="relative z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Orbit home">
            <img src="/logo.png" alt="" className="size-9 rounded-xl" />
            <span className="text-xl font-semibold tracking-tight">Orbit</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">How it works</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isSignedIn ? <>
              {session?.user?.name && <span className="hidden text-xs font-medium text-slate-500 lg:inline">Hi, {session.user.name.split(' ')[0]}</span>}
              <Link href="/workspace" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Open workspace</Link>
              <button type="button" onClick={() => void signOut({ callbackUrl: '/' })} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:px-4">Sign out</button>
            </> : <>
              <Link href="/sign-in" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Sign in</Link>
              <Link href="/sign-up" className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-800 px-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/15 transition hover:bg-blue-900 sm:px-4">Create account <ArrowRight className="size-4" /></Link>
            </>}
          </div>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm"><span className="flex size-5 items-center justify-center rounded-full bg-blue-100"><Sparkles className="size-3" /></span> Your workspace for agentic work</div>
          <h1 className="mt-6 text-[clamp(2.75rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-slate-950">Automate Routine Tasks. <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 bg-clip-text text-transparent">Focus on What Matters.</span></h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 lg:mx-0">Create AI agents for the work you repeat. Give them the right tools, set a schedule, and keep every run organized in one workspace.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href={isSignedIn ? '/workspace' : '/sign-up'} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-900">{isSignedIn ? 'Open your workspace' : 'Build your first agent'} <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500 lg:justify-start">
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> Set up in minutes</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> Connect your existing apps</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[620px] lg:mx-0 lg:ml-auto">
          <div className="absolute -inset-4 rounded-[34px] bg-gradient-to-br from-blue-200/50 via-indigo-100/40 to-violet-200/50 blur-2xl" />
          <img
            src="/orbit-workspace-preview.svg"
            alt="Orbit workspace showing an active research assistant and a scheduled project digest"
            className="relative h-auto w-full rounded-[24px] border border-slate-200/90 shadow-[0_28px_80px_rgba(30,64,175,0.14)]"
          />
        </div>
      </section>

      <section id="features" className="relative z-10 border-y border-slate-200/80 bg-slate-50/70 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">A calmer way to get things done</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">From a simple prompt to a reliable workflow</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">Orbit gives your AI agents a home, the tools to take action, and a schedule to keep work moving.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, tint }, index) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_16px_rgba(15,23,42,0.035)] sm:p-7">
                <div className="flex items-center justify-between"><span className={`flex size-11 items-center justify-center rounded-xl ring-1 ${tint}`}><Icon className="size-5" /></span><span className="text-xs font-semibold text-slate-300">0{index + 1}</span></div>
                <h3 className="mt-5 text-base font-semibold tracking-tight text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">A capable teammate, shaped around your work.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">Start with a goal. Orbit helps you set up an agent, choose its connected apps, and decide when a routine should run.</p>
            <Link href={isSignedIn ? '/workspace' : '/sign-up'} className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900">{isSignedIn ? 'Open your workspace' : 'Create your workspace'} <ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StepCard number="01" icon={WandSparkles} title="Describe the work" text="Give your agent a name and explain what you need." />
            <StepCard number="02" icon={Layers3} title="Connect the tools" text="Authorize the apps your agent can use to take action." />
            <StepCard number="03" icon={Workflow} title="Let it run" text="Chat whenever you need—or schedule repeatable work." />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-slate-700"><img src="/logo.png" alt="" className="size-6 rounded-md" />Orbit</Link>
          <span>Make room for work that matters.</span>
          {isSignedIn
            ? <button type="button" onClick={() => void signOut({ callbackUrl: '/' })} className="text-left font-semibold text-blue-800 hover:text-blue-950">Sign out <ArrowRight className="ml-1 inline size-3.5" /></button>
            : <Link href="/sign-in" className="font-semibold text-blue-800 hover:text-blue-950">Sign in to your workspace <ArrowRight className="ml-1 inline size-3.5" /></Link>}
        </div>
      </footer>
    </main>
  );
}

function StepCard({ number, icon: Icon, title, text }: {
  number: string;
  icon: typeof WandSparkles;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
      <div className="flex items-center justify-between"><Icon className="size-5 text-blue-700" /><span className="text-xs font-semibold text-slate-300">{number}</span></div>
      <h3 className="mt-5 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </article>
  );
}
