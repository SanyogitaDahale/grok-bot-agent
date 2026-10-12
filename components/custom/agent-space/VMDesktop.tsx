'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Maximize2, Monitor, Pause, Play, X } from 'lucide-react';
import { useParams } from 'next/navigation';

type VMStatus = 'inactive' | 'starting' | 'running' | 'paused' | 'error';
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

export default function VMDesktop() {
  const { agentId } = useParams<{ agentId: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<VMStatus>('inactive');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityUpdate = useRef(0);
  const desktopFrame = useRef<HTMLIFrameElement>(null);
  const previewStreamUrl = useMemo(() => {
    if (!streamUrl) return null;
    const url = new URL(streamUrl);
    url.searchParams.set('view_only', 'true');
    return url.toString();
  }, [streamUrl]);

  const pauseDesktop = useCallback(async () => {
    if (!agentId) return;
    try {
      const response = await fetch('/api/agent/vm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'pause' }),
      });
      if (!response.ok) throw new Error('Could not pause the desktop.');
      setStatus('paused');
      setStreamUrl(null);
    } catch {
      setErrorMessage('Could not pause the desktop.');
      setStatus('error');
    }
  }, [agentId]);

  const activateDesktop = useCallback(async () => {
    if (!agentId || status === 'starting') return;
    setStatus('starting');
    setErrorMessage('');
    try {
      const response = await fetch('/api/agent/vm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'activate' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start the desktop.');
      setStreamUrl(data.streamUrl);
      setStatus('running');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not start the desktop.');
      setStatus('error');
    }
  }, [agentId, status]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    // Events inside the cross-origin desktop iframe do not bubble to this page.
    // Keep the sandbox active while the user has focused the desktop itself.
    if (desktopFrame.current && document.activeElement === desktopFrame.current) return;
    if (status === 'running' && isOpen) {
      idleTimer.current = setTimeout(() => void pauseDesktop(), IDLE_TIMEOUT_MS);
      const now = Date.now();
      if (now - lastActivityUpdate.current >= 15_000) {
        lastActivityUpdate.current = now;
        void fetch('/api/agent/vm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, action: 'activity' }),
        });
      }
    }
  }, [agentId, isOpen, pauseDesktop, status]);

  const noteDesktopFocus = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const now = Date.now();
    if (now - lastActivityUpdate.current >= 15_000) {
      lastActivityUpdate.current = now;
      void fetch('/api/agent/vm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'activity' }),
      });
    }
  };

  useEffect(() => {
    if (status !== 'running') return;
    if (!isOpen) {
      idleTimer.current = setTimeout(() => void pauseDesktop(), IDLE_TIMEOUT_MS);
      return () => {
        if (idleTimer.current) clearTimeout(idleTimer.current);
      };
    }
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'wheel'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isOpen, resetIdleTimer, status]);

  useEffect(() => () => {
    if (status === 'running' && agentId) {
      void fetch('/api/agent/vm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'pause' }),
        keepalive: true,
      });
    }
  }, [agentId, status]);

  const openDesktop = () => {
    setIsOpen(true);
    if (status !== 'running') void activateDesktop();
  };

  const closeDesktop = () => {
    setIsOpen(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };

  return (
    <>
      <section className="mb-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-blue-50/80 to-slate-100 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white shadow-sm">
              <Monitor className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">VM Desktop</h3>
              <p className="text-xs text-slate-500">
                {status === 'running' ? 'Ready to use' : status === 'starting' ? 'Connecting…' : status === 'paused' ? 'Paused · session saved' : status === 'error' ? 'Needs attention' : 'Private desktop for this agent'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openDesktop}
            disabled={status === 'starting'}
            aria-label={status === 'running' ? 'Expand VM Desktop' : undefined}
            title={status === 'running' ? 'Expand VM Desktop' : undefined}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-blue-900 px-3 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70"
          >
            {status === 'starting' ? <LoaderCircle className="size-4 animate-spin" /> : status === 'running' ? <Maximize2 className="size-4" /> : <Play className="size-4" />}
            {status === 'running' ? 'Expand' : status === 'starting' ? 'Starting' : 'Launch'}
          </button>
        </div>
        <div className="group relative mt-3 h-48 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:h-52">
          {status === 'running' && previewStreamUrl ? (
            <>
              <iframe
                title="Read-only VM desktop preview"
                src={previewStreamUrl}
                tabIndex={-1}
                className="pointer-events-none size-full bg-black"
              />
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label="Open interactive VM Desktop"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition hover:bg-slate-900 focus:opacity-100 group-hover:opacity-100"
              >
                <Maximize2 className="size-3.5" /> Expand
              </button>
            </>
          ) : status === 'starting' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center text-slate-300">
              <LoaderCircle className="size-8 animate-spin text-blue-400" />
              <p className="text-sm">Starting this agent’s desktop…</p>
            </div>
          ) : status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-5 text-center">
              <Monitor className="size-8 text-rose-300" />
              <div>
                <p className="text-sm font-medium text-white">Could not start the desktop</p>
                <p className="mt-1 text-xs text-slate-400">{errorMessage || 'Please try again.'}</p>
              </div>
              <button type="button" onClick={openDesktop} className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-500">
                Try again
              </button>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-5 text-center">
              {status === 'paused' ? <Pause className="size-8 text-amber-300" /> : <Monitor className="size-8 text-blue-300" />}
              <div>
                <p className="text-sm font-medium text-white">{status === 'paused' ? 'Desktop is paused' : 'Desktop is inactive'}</p>
                <p className="mt-1 text-xs text-slate-400">{status === 'paused' ? 'Your session is saved and ready to resume.' : 'Activate this agent’s private desktop to continue.'}</p>
              </div>
              <button type="button" onClick={openDesktop} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-500">
                <Play className="size-3.5" /> {status === 'paused' ? 'Resume desktop' : 'Activate desktop'}
              </button>
            </div>
          )}
        </div>
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="VM Desktop">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900 px-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-medium"><Monitor className="size-4 text-blue-300" /> VM Desktop</div>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span className={`size-2 rounded-full ${status === 'running' ? 'bg-emerald-400' : 'bg-amber-400'}`} />{status === 'running' ? 'Active · pauses after 2 minutes idle' : status === 'paused' ? 'Paused · session preserved' : 'Connecting'}</span>
              {status === 'paused' && <button type="button" onClick={() => void activateDesktop()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500"><Play className="mr-1 inline size-3" />Resume</button>}
              <button type="button" onClick={closeDesktop} aria-label="Close VM Desktop" className="inline-flex size-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[#111827] p-3 sm:p-6">
            {status === 'running' && streamUrl ? (
              <iframe
                ref={desktopFrame}
                title="Interactive VM desktop"
                src={streamUrl}
                allow="clipboard-read; clipboard-write; fullscreen"
                onFocus={noteDesktopFocus}
                onBlur={resetIdleTimer}
                className="size-full rounded-xl border border-white/10 bg-black shadow-2xl"
              />
            ) : status === 'starting' ? (
              <div className="flex flex-col items-center gap-3 text-slate-300"><LoaderCircle className="size-8 animate-spin text-blue-400" /><p>Starting this agent’s desktop…</p></div>
            ) : status === 'paused' ? (
              <div className="flex flex-col items-center gap-3 text-center"><Pause className="size-9 text-amber-300" /><p className="text-lg font-medium">Desktop paused</p><p className="text-sm text-slate-400">Your agent’s desktop session is saved and can be resumed.</p><button type="button" onClick={() => void activateDesktop()} className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">Resume desktop</button></div>
            ) : (
              <div className="max-w-md text-center"><p className="text-sm text-rose-300">{errorMessage || 'The desktop could not be loaded.'}</p><button type="button" onClick={() => void activateDesktop()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">Try again</button></div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
