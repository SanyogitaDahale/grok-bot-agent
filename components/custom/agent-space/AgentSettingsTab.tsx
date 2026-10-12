'use client';

import { useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Copy, LoaderCircle, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AgentConfigContext } from '@/context/AgentConfigContext';
import { toast } from '@/components/ui/toast';
import { AGENT_CHAT_RESET_EVENT } from './agent-data';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AgentSettingsTab() {
  const router = useRouter();
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext) ?? {};
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isActive = agentConfig?.isActive !== false;

  const toggleAgent = async () => {
    if (!agentConfig?.agentid || isSaving) return;
    setIsSaving(true);
    try {
      const nextIsActive = !isActive;
      const { data } = await axios.patch('/api/agent', { agentId: agentConfig.agentid, isActive: nextIsActive });
      setAgentConfig((current: typeof agentConfig) => current ? { ...current, isActive: data.agentConfig.isActive } : current);
      toast.add({
        title: nextIsActive ? 'Agent resumed' : 'Agent paused',
        description: nextIsActive ? 'Scheduled routine runs are active again.' : 'Scheduled and queued routine runs will stay paused.',
        type: 'success',
      });
    } catch (error) {
      toast.add({ title: 'Could not update agent', description: axios.isAxiosError(error) ? error.response?.data?.error ?? error.message : 'Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAgent = async () => {
    if (!agentConfig?.agentid || isDeleting) return;
    setIsDeleting(true);
    try {
      await axios.delete('/api/agent', { params: { agentId: agentConfig.agentid } });
      toast.add({ title: 'Agent deleted', description: `${agentConfig.name} and its scheduled routines were deleted.`, type: 'success' });
      router.push('/workspace');
    } catch (error) {
      toast.add({ title: 'Could not delete agent', description: axios.isAxiosError(error) ? error.response?.data?.error ?? error.message : 'Please try again.', type: 'error' });
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  const duplicateAgent = async () => {
    if (!agentConfig?.agentid || isDuplicating) return;
    setIsDuplicating(true);
    const newAgentId = crypto.randomUUID();
    try {
      await axios.post('/api/agent', {
        agentId: newAgentId,
        sourceAgentId: agentConfig.agentid,
        name: `Copy of ${agentConfig.name}`,
      });
      toast.add({ title: 'Agent duplicated', description: `${agentConfig.name} was copied with its settings and tools.`, type: 'success' });
      router.push(`/workspace/${encodeURIComponent(newAgentId)}`);
    } catch (error) {
      toast.add({ title: 'Could not duplicate agent', description: axios.isAxiosError(error) ? error.response?.data?.error ?? error.message : 'Please try again.', type: 'error' });
      setIsDuplicating(false);
    }
  };

  const resetAgent = async () => {
    if (!agentConfig?.agentid || isResetting) return;
    setIsResetting(true);
    try {
      await axios.delete('/api/agent/chat', { params: { agentId: agentConfig.agentid } });
      window.dispatchEvent(new CustomEvent(AGENT_CHAT_RESET_EVENT, { detail: { agentId: agentConfig.agentid } }));
      toast.add({ title: 'Conversation reset', description: `${agentConfig.name}'s chat history was cleared.`, type: 'success' });
      setResetOpen(false);
    } catch (error) {
      toast.add({ title: 'Could not reset conversation', description: axios.isAxiosError(error) ? error.response?.data?.error ?? error.message : 'Please try again.', type: 'error' });
      setResetOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">General</h3>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">Manage this agent and its workspace.</p>
      </div>

      <div className="divide-y divide-blue-100 rounded-xl border border-blue-200 bg-white/90 shadow-sm shadow-blue-100/50">
        <button type="button" disabled={!agentConfig || isDuplicating} onClick={() => void duplicateAgent()} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60">
          <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Copy className="size-3.5" /></span>
          <span className="flex-1"><span className="block text-sm font-medium text-slate-800">Duplicate agent</span><span className="mt-0.5 block text-[12px] text-slate-500">Create a copy of this agent</span></span>
          {isDuplicating ? <LoaderCircle className="size-4 animate-spin text-slate-400" /> : <Plus className="size-3.5 text-slate-400" />}
        </button>

        <button type="button" role="switch" aria-checked={isActive} aria-label={isActive ? 'Pause agent' : 'Resume agent'} disabled={!agentConfig || isSaving} onClick={() => void toggleAgent()} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60">
          <span className={`flex size-8 items-center justify-center rounded-lg ${isActive ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-700'}`}>{isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</span>
          <span className="flex-1"><span className="block text-sm font-medium text-slate-800">{isActive ? 'Pause agent' : 'Resume agent'}</span><span className="mt-0.5 block text-[12px] text-slate-500">{isActive ? 'Temporarily stop scheduled runs' : 'Allow scheduled runs to continue'}</span></span>
          {isSaving ? <LoaderCircle className="size-4 animate-spin text-slate-400" /> : <span aria-hidden="true" className={`h-5 w-9 rounded-full p-0.5 transition ${isActive ? 'bg-blue-700' : 'bg-slate-300'}`}><span className={`block size-4 rounded-full bg-white shadow-sm transition ${isActive ? 'translate-x-4' : ''}`} /></span>}
        </button>

        <button type="button" disabled={!agentConfig || isResetting} onClick={() => setResetOpen(true)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><RefreshCw className="size-3.5" /></span>
          <span className="flex-1"><span className="block text-sm font-medium text-slate-800">Reset agent</span><span className="mt-0.5 block text-[12px] text-slate-500">Clear the agent&apos;s conversation</span></span>
          {isResetting ? <LoaderCircle className="size-4 animate-spin text-slate-400" /> : <RefreshCw className="size-3.5 text-slate-400" />}
        </button>
      </div>

      <div className="rounded-xl border border-red-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">Deleting this agent also deletes its scheduled routines and cannot be undone.</p>
        <button type="button" disabled={!agentConfig} onClick={() => setDeleteOpen(true)} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-[13px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-3.5" />Delete Agent</button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {agentConfig?.name ?? 'this agent'}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the agent, its scheduled routines, and routine execution history. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={(event) => { event.preventDefault(); void deleteAgent(); }} className="bg-red-600 text-white hover:bg-red-700">
              {isDeleting && <LoaderCircle className="size-4 animate-spin" />}{isDeleting ? 'Deleting…' : 'Delete agent'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {agentConfig?.name ?? 'this agent'}’s conversation?</AlertDialogTitle>
            <AlertDialogDescription>This clears the conversation history for this agent. Its tools, settings, and scheduled routines will stay as they are.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isResetting} onClick={(event) => { event.preventDefault(); void resetAgent(); }}>
              {isResetting && <LoaderCircle className="size-4 animate-spin" />}{isResetting ? 'Resetting…' : 'Reset conversation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
