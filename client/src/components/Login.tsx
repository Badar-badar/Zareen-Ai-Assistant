import { useState, type FormEvent } from 'react';
import { login } from '../api/authApi';
import { setToken } from '../auth/token';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setToken(await login(email, password));
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm p-6 bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl flex flex-col gap-3"
    >
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
      <input
        type="email"
        required
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1f2c34] text-slate-900 dark:text-slate-100 text-sm"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1f2c34] text-slate-900 dark:text-slate-100 text-sm"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button disabled={busy} className="py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}