'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function CreateAgent() {
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('Felix');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();


  function shuffleAvatar() {
    setAvatarSeed(crypto.randomUUID());
  }

  async function createAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const avatarImage =
        `https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${encodeURIComponent(avatarSeed)}`;

      const newAgentID = crypto.randomUUID();

      const result = await axios.post('/api/agent', {
        name: name.trim(),
        description: description.trim(),
        agentImage: avatarImage,
        agentId: newAgentID,
      });

      console.log(result.data);
      router.push('/workspave/' + newAgentID)
    }
    catch (error) {
      console.error('Failed to create agent:', error);
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Create New Agent
          </h1>
        </header>

        <form
          onSubmit={createAgent}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <section
            className="flex flex-col items-center gap-4 border-b border-slate-100 py-3 pb-6"
            aria-label="Agent avatar"
          >
            <img
              key={avatarSeed}
              src={`https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${encodeURIComponent(avatarSeed)}`}
              alt="Agent avatar"
              className="size-24 rounded-full bg-slate-50 object-cover ring-1 ring-slate-200"
            />

            <div className="flex min-w-0 flex-col items-center">
              <p className="text-sm font-medium text-slate-800">
                Agent avatar
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Choose a look that feels right
              </p>

              <button
                type="button"
                onClick={shuffleAvatar}
                className="mt-5 inline-flex h-8 items-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-3 text-xs font-medium text-white shadow-sm transition hover:border-blue-600 hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Shuffle Image
              </button>
            </div>
          </section>

          <div className="space-y-4 py-5">
            <div>
              <label
                htmlFor="agent-name"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Agent Name
              </label>

              <input
                id="agent-name"
                name="name"
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Research Assistant"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="agent-description"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Instruction/Description{' '}
                <span className="font-normal text-slate-400">
                  (optional)
                </span>
              </label>

              <textarea
                id="agent-description"
                name="description"
                rows={3}
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this agent will help you with..."
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Link
              href="/workspace"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-3.5" aria-hidden="true" />
              )}

              {isLoading ? 'Creating...' : 'Create Agent'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}