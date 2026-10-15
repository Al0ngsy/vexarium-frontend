/** Unsigned JWT-shaped token with the given payload (the client never verifies it). */
export function makeJwt(payload: Record<string, unknown>): string {
	const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`;
}
