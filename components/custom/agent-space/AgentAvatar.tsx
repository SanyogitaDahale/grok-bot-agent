import { RefreshCw } from 'lucide-react';
import { AGENT_AVATAR_URL } from './agent-data';

export default function AgentAvatar() {
  return (
    <div className="border-b border-blue-200 bg-white/90 px-6 pb-5 pt-5">
      <div className="flex items-center gap-3.5">
        <img src={AGENT_AVATAR_URL} alt="Orbit Assistant avatar" className="size-[58px] rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-100 to-slate-100 object-cover ring-4 ring-blue-50" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Agent image</p>
          <button type="button" className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[13px] font-medium text-blue-900 transition hover:bg-blue-100"><RefreshCw className="size-3" />Shuffle Avatar</button>
        </div>
      </div>
      <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-slate-700">Agent Name</span><input defaultValue="Orbit Assistant" className="h-9 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
    </div>
  );
}
