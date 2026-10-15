import { vi } from 'vitest';

/** Set an input's value the way typing would, so `bind:value` picks it up. */
export function type(root: ParentNode, selector: string, value: string): void {
	const input = root.querySelector<HTMLInputElement>(selector);
	if (!input) throw new Error(`no element for ${selector}`);
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

export const submit = (form: HTMLFormElement | null): void => form!.requestSubmit();

export const jsonResponse = (data: unknown, status = 200) =>
	new Response(status === 204 ? null : JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

export interface FetchCall {
	method: string;
	path: string;
	authorization: string | null;
	body: unknown;
}

/** Stub fetch with a handler; returns the recorded calls. */
export function stubFetch(handler: (c: FetchCall) => Response | Promise<Response>): FetchCall[] {
	const calls: FetchCall[] = [];
	vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
		const call: FetchCall = {
			method: init.method ?? 'GET',
			path: new URL(String(input)).pathname,
			authorization: new Headers(init.headers).get('Authorization'),
			body: init.body ? JSON.parse(init.body as string) : undefined
		};
		calls.push(call);
		return handler(call);
	});
	return calls;
}

export const meBody = (over: Record<string, unknown> = {}) => ({
	id: 1,
	email: 'a@b.c',
	tier: 'free',
	subscription_status: null,
	current_period_end: null,
	created_at: '2026-01-01T00:00:00Z',
	...over
});

/** Resolve on the next macrotask, after pending promise chains have run. */
export const tick = () => new Promise((r) => setTimeout(r, 0));
