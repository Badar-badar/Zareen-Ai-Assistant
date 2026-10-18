import type { PendingAction } from '../types/chat';
export function botApi(message: string): Promise<{ text: string; actions: PendingAction[] }>;
export function botStream(
  message: string,
  opts?: {
    signal?: AbortSignal;
    onDelta?: (text: string) => void;
    onReset?: () => void;
    onReplace?: (text: string) => void;
  }
): Promise<{ text: string; actions: PendingAction[]; aborted?: boolean }>;
export function resetSession(): void;