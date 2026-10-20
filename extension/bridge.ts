import type { Library, LibraryCommand } from './library'
export const INTENT_KEY = 'kp-selection-intent'
export type SelectionIntent = { id: string; text: string; pageUrl: string; createdAt: number }
export type Request = { type: 'library-read' } | { type: 'library-change'; command: LibraryCommand } | { type: 'intent-read' } | { type: 'intent-ack'; id: string }
export type Reply = { ok: true; library?: Library; intent?: SelectionIntent | null } | { ok: false; error: string }
type Listener<T extends unknown[]> = { addListener(callback: (...args: T) => void): void; removeListener(callback: (...args: T) => void): void }
export type ExtensionAPI = {
  runtime: {
    id: string; lastError?: { message?: string };
    sendMessage(message: Request): Promise<Reply>;
    onInstalled: Listener<[]>; onStartup: Listener<[]>;
    onMessage: { addListener(callback: (message: Request, sender: { id?: string }, respond: (reply: Reply) => void) => boolean | undefined): void };
  };
  storage: {
    local: { get(key: string): Promise<Record<string, unknown>>; set(values: Record<string, unknown>): Promise<void>; remove(key: string): Promise<void> };
    onChanged: Listener<[Record<string, { newValue?: unknown }>, string]>;
  };
  contextMenus: {
    removeAll(): Promise<void>;
    create(properties: { id: string; title: string; contexts: string[] }): void;
    onClicked: Listener<[{ menuItemId: string | number; selectionText?: string; pageUrl?: string }]>;
  };
  action: { openPopup(): Promise<void>; setBadgeText(details: { text: string }): Promise<void>; setBadgeBackgroundColor(details: { color: string }): Promise<void>; setTitle(details: { title: string }): Promise<void> };
}
export const extensionAPI = (globalThis as typeof globalThis & { browser?: ExtensionAPI; chrome?: ExtensionAPI }).browser
  || (globalThis as typeof globalThis & { chrome?: ExtensionAPI }).chrome!
export async function send(request: Request): Promise<Extract<Reply, { ok: true }>> {
  const reply = await extensionAPI.runtime.sendMessage(request)
  if (!reply?.ok) throw new Error(reply && 'error' in reply ? reply.error : 'Нет связи с расширением. Обновите его на странице расширений.')
  return reply
}
