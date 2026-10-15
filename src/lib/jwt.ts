/** Expiry (`exp`, in ms since the epoch) of a JWT, or null when the token has
 * none or is not a decodable JWT. The signature is not checked: the server
 * does that, this only lets the client log out when the token has run out. */
export function jwtExpiryMs(token: string): number | null {
	const part = token.split('.')[1];
	if (!part) return null;
	try {
		const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
		const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
		const exp = (JSON.parse(json) as { exp?: unknown }).exp;
		return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
	} catch {
		return null;
	}
}

export function isExpired(token: string, now = Date.now()): boolean {
	const exp = jwtExpiryMs(token);
	return exp !== null && exp <= now;
}
