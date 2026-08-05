<script lang="ts">
	import LegalLayout from '../../../components/LegalLayout.svelte';
</script>

<LegalLayout title="PRIVACY POLICY">
	<section>
		<p class="label mb-2">1. CONTROLLER</p>
		<p style="color: var(--foreground); line-height: 1.7">
			VEXARIUM<br />
			Lê Quốc Anh Trần<br />
			Glogauer Str. 11, 90473 Nürnberg, Germany<br />
			E-Mail: lequocanhtr@gmail.com
		</p>
		<p class="label mt-3" style="color: var(--foreground-muted); text-transform: none">
			Controller of your personal data within the meaning of the GDPR (Art. 4 No. 7 GDPR).
		</p>
	</section>

	<section>
		<p class="label mb-2">2. DATA WE COLLECT &amp; LEGAL BASIS</p>
		<p style="color: var(--foreground); line-height: 1.7">
			We process personal data only to the extent necessary to provide the service.
		</p>
		<ul class="label" style="color: var(--foreground); line-height: 1.9">
			<li><strong>Account (email + password hash)</strong> — to create and manage your
				account (Art. 6(1)(b) GDPR). Passwords are stored as salted bcrypt hashes, never in
				plaintext.</li>
			<li><strong>Saved trades / portfolio entries</strong> — to provide the portfolio
				feature you request (Art. 6(1)(b) GDPR).</li>
			<li><strong>Subscription &amp; payment</strong> — processed by Stripe on your behalf;
				we receive only the subscription status (Art. 6(1)(b)/(f) GDPR).</li>
			<li><strong>AI analysis</strong> — the symbol/indicator data you request is sent to our
				LLM provider to generate the analysis you asked for (Art. 6(1)(b)/(f) GDPR).</li>
			<li><strong>Server logs</strong> — IP address, timestamps, and request metadata for
				security, abuse prevention, and rate limiting (Art. 6(1)(f) GDPR, legitimate
				interest in operating a secure service).</li>
		</ul>
	</section>

	<section>
		<p class="label mb-2">3. BROWSER STORAGE (NO COOKIES)</p>
		<p style="color: var(--foreground); line-height: 1.7">
			VEXARIUM sets <strong>no cookies</strong>. It stores strictly-necessary data in your
			browser's <code>localStorage</code> to make the service work:
		</p>
		<ul class="label" style="color: var(--foreground); line-height: 1.9">
			<li><code>vexarium_token</code> / <code>vexarium_user</code> — your session token and
				account tier, so you stay logged in.</li>
			<li><code>vexarium_trades</code> — your saved trades (portfolio).</li>
			<li><code>vexarium_recent</code> — your recent analyses.</li>
			<li><code>vexarium_consent_v1</code> — records that you acknowledged this disclosure.</li>
		</ul>
		<p style="color: var(--foreground); line-height: 1.7">
			These are strictly necessary for the functionality you request (TTDSG §25(2) No. 2).
			No advertising, tracking, or analytics cookies are used.
		</p>
	</section>

	<section>
		<p class="label mb-2">4. THIRD-PARTY PROCESSORS</p>
		<p style="color: var(--foreground); line-height: 1.7">
			We use the following processors to host and operate the service:
		</p>
		<ul class="label" style="color: var(--foreground); line-height: 1.9">
			<li><strong>Render</strong> (USA) — application hosting.</li>
			<li><strong>Neon</strong> (Frankfurt, EU) — PostgreSQL database.</li>
			<li><strong>Upstash</strong> (EU/USA) — Redis cache and rate limiting.</li>
			<li><strong>Cloudflare</strong> (USA) — frontend hosting and CDN.</li>
			<li><strong>Stripe</strong> (USA) — payment processing.</li>
			<li><strong>Alpaca</strong> (USA) — market data.</li>
			<li><strong>LLM provider (ollama-cloud)</strong> — AI analysis generation.</li>
		</ul>
	</section>

	<section>
		<p class="label mb-2">5. INTERNATIONAL TRANSFERS</p>
		<p style="color: var(--foreground); line-height: 1.7">
			Some processors are located outside the European Economic Area (primarily the USA).
			Where personal data is transferred to a third country, we rely on appropriate
			safeguards under Art. 44–49 GDPR, including the EU–US Data Privacy Framework (for
			certified US providers) and/or the European Commission's Standard Contractual Clauses.
		</p>
	</section>

	<section>
		<p class="label mb-2">6. RETENTION</p>
		<p style="color: var(--foreground); line-height: 1.7">
			We retain account data and saved trades for as long as your account is active. AI
			analysis results are cached per symbol per day and discarded automatically. Server
			logs are retained for a limited period (typically up to 30 days) for security
			purposes. You may delete your saved trades at any time; account deletion is available
			on request.
		</p>
	</section>

	<section>
		<p class="label mb-2">7. YOUR RIGHTS (GDPR)</p>
		<p style="color: var(--foreground); line-height: 1.7">
			If you are located in the European Economic Area, you have the right to:
		</p>
		<ul class="label" style="color: var(--foreground); line-height: 1.9">
			<li>Access the personal data we hold about you (Art. 15 GDPR).</li>
			<li>Request correction of inaccurate data (Art. 16 GDPR).</li>
			<li>Request deletion of your data (Art. 17 GDPR).</li>
			<li>Restrict or object to processing (Art. 18, 21 GDPR).</li>
			<li>Data portability (Art. 20 GDPR).</li>
			<li>Withdraw consent at any time where processing is based on consent.</li>
			<li>Lodge a complaint with your supervisory authority, in Germany the
				Bayerische Landesamt für Datenschutzaufsicht (BayLDA).</li>
		</ul>
	</section>

	<section>
		<p class="label mb-2">8. CONTACT</p>
		<p style="color: var(--foreground); line-height: 1.7">
			To exercise any of your rights or for any privacy question, contact us at
			<strong>lequocanhtr@gmail.com</strong>.
		</p>
	</section>
</LegalLayout>
