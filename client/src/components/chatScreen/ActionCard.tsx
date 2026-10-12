import { useState } from 'react';
import { Check, X, ShieldQuestion } from 'lucide-react';
import type { PendingAction } from '../../types/chat';
import { confirmAction, cancelAction } from '../../api/actionsApi';

type CardState = 'idle' | 'busy' | 'confirmed' | 'cancelled' | 'error';

export function ActionCard({ action }: { action: PendingAction }) {
  const [state, setState] = useState<CardState>('idle');
  const [note, setNote] = useState('');

  const [expired, setExpired] = useState(() => new Date(action.expiresAt).getTime() < Date.now());
  const expiresAt = new Date(action.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const done = state === 'confirmed' || state === 'cancelled';

  const run = async (verb: 'confirm' | 'cancel') => {
    if (state === 'busy' || done) return; // blocks double-clicks (the server blocks them too)
    if (verb === 'confirm' && new Date(action.expiresAt).getTime() < Date.now()) {
      setExpired(true);
      return;
    }
    setState('busy');
    const r = await (verb === 'confirm' ? confirmAction(action.id) : cancelAction(action.id));
    if (r.ok) {
      setState(verb === 'confirm' ? 'confirmed' : 'cancelled');
      setNote(verb === 'confirm' ? `Created${r.label ? `: ${r.label}` : ''}` : 'Cancelled. Nothing was created.');
    } else {
      setState('error');
      setNote(r.error ?? 'Something went wrong.');
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-amber-300/70 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300 mb-1">
        <ShieldQuestion className="w-3.5 h-3.5" />
        Needs your approval
      </div>

      {/* Text comes from the saved record on the server, not from the model's chat message */}
      <p className="text-slate-800 dark:text-slate-100 break-words">{action.summary}</p>

      {!done && (
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          {expired ? 'This request has expired.' : `Nothing is saved until you confirm. Expires at ${expiresAt}.`}
        </p>
      )}

      {done ? (
        <p
          className={`mt-2 flex items-center gap-1 font-medium ${
            state === 'confirmed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {state === 'confirmed' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          {note}
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => run('confirm')}
            disabled={state === 'busy' || expired}
            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {state === 'busy' ? 'Working…' : 'Confirm'}
          </button>
          <button
            onClick={() => run('cancel')}
            disabled={state === 'busy'}
            className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          {state === 'error' && <span className="text-red-500">{note}</span>}
        </div>
      )}
    </div>
  );
}