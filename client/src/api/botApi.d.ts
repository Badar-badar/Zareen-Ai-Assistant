// botApi.d.ts
import type { PendingAction } from '../types/chat';
export function botApi(message: string): Promise<{ text: string; actions: PendingAction[] }>;
export function resetSession(): void;