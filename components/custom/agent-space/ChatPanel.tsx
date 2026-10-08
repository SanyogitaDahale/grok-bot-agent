import { ArrowUp, Copy, MoreHorizontal, RefreshCw, Sparkles } from 'lucide-react';
import { AGENT_AVATAR_URL } from './agent-data';

function ChatHeader() {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-blue-100 bg-white px-7">
      <div className="flex min-w-0 items-center gap-3"><img src={AGENT_AVATAR_URL} alt="Orbit assistant avatar" className="size-10 rounded-xl border border-blue-200 bg-blue-50 object-cover ring-2 ring-blue-50" /><div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-tight">Orbit Assistant</h1><p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500"><span className="size-1.5 rounded-full bg-cyan-500 shadow-[0_0_0_3px_rgba(6,182,212,0.12)]" />Ready to help</p></div></div>
      <div className="flex items-center gap-2.5"><span className="text-sm font-medium text-slate-500">Active</span><span aria-label="Agent active" className="relative inline-flex h-6 w-11 rounded-full bg-emerald-500 p-[3px]"><span className="ml-auto size-[18px] rounded-full bg-white shadow-sm" /></span><button type="button" aria-label="More chat options" className="ml-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal className="size-5" /></button></div>
    </header>
  );
}

function Conversation() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 overflow-y-auto px-8 py-10">
      <div className="flex justify-end"><div className="max-w-[78%] rounded-2xl rounded-br-md bg-gradient-to-br from-blue-800 via-blue-900 to-slate-950 px-4 py-3 text-[15px] leading-6 text-white shadow-[0_8px_24px_rgba(15,39,120,0.28)]">Can you help me get organized for the week? I have a few projects to follow up on.</div></div>
      <div className="flex items-start gap-3">
        <img src={AGENT_AVATAR_URL} alt="" className="mt-0.5 size-8 shrink-0 rounded-lg border border-blue-100 bg-white ring-2 ring-blue-50" />
        <div className="min-w-0 max-w-[84%]">
          <div className="mb-2 flex items-center gap-2"><span className="text-sm font-semibold text-blue-950">Orbit Assistant</span><span className="text-[13px] text-slate-400">Just now</span></div>
          <div className="space-y-3 text-[15px] leading-6 text-slate-600">
            <p>Absolutely. Let&apos;s make the week feel manageable. Here&apos;s a simple place to start:</p>
            <div className="rounded-xl border border-blue-100 bg-white/90 p-4 shadow-sm shadow-blue-100/50"><p className="mb-2 font-medium text-blue-950">A good first pass</p><ul className="space-y-1.5"><li className="flex gap-2"><span className="text-slate-300">•</span><span>Choose your top three priorities for the week</span></li><li className="flex gap-2"><span className="text-slate-300">•</span><span>Block focused time for the most important project</span></li><li className="flex gap-2"><span className="text-slate-300">•</span><span>Leave a little space for follow-ups and new requests</span></li></ul></div>
            <p>What projects are on your list? I can help you turn them into a clear plan.</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-slate-400"><button type="button" aria-label="Copy response" className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-600"><Copy className="size-3.5" /></button><button type="button" aria-label="Regenerate response" className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-600"><RefreshCw className="size-3.5" /></button></div>
        </div>
      </div>
    </div>
  );
}

function MessageComposer() {
  return (
    <div className="mx-auto w-full max-w-3xl px-8 pb-6">
      <div className="rounded-2xl border border-blue-100 bg-white/95 p-3 shadow-[0_8px_28px_rgba(15,39,120,0.12)] transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100"><textarea aria-label="Message your agent" rows={2} placeholder="Ask your agent anything..." className="w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-slate-800 outline-none placeholder:text-slate-400" /><div className="flex items-center justify-between pt-2"><span className="flex items-center gap-1.5 text-[13px] text-blue-800"><Sparkles className="size-3.5" />Your agent is ready</span><button type="button" aria-label="Send message" className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-800 to-blue-950 text-white shadow-md shadow-blue-200 transition hover:from-blue-900 hover:to-slate-950"><ArrowUp className="size-4" /></button></div></div>
      <p className="mt-2.5 text-center text-[12px] text-slate-400">Your agent can make mistakes. Review important information.</p>
    </div>
  );
}

export default function ChatPanel() {
  return <section className="flex min-w-0 flex-1 flex-col"><ChatHeader /><div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-slate-50/50 to-white"><Conversation /><MessageComposer /></div></section>;
}
