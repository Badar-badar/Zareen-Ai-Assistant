// actionsApi.d.ts
export interface ActionResult { ok: boolean; status?: string; label?: string; error?: string }
export function confirmAction(id: string): Promise<ActionResult>;
export function cancelAction(id: string): Promise<ActionResult>;