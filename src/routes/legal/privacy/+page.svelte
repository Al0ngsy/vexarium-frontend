<script lang="ts">
	import LegalLayout from '../../../components/LegalLayout.svelte';
</script>

<LegalLayout title="PRIVACY POLICY">
	<section>
		<p class="label mb-2">DATA WE COLLECT</p>
		<p style="color: var(--foreground); line-height: 1.7">
			When you create an account, we collect your email address. When you save trades to your
			portfolio, we store those saved trades and any related settings you provide. We do not
			collect more personal information than is necessary to operate the service.
		</p>
	</section>

	<section>
		<p class="label mb-2">HOW WE USE YOUR DATA</p>
		<p style="color: var(--foreground); line-height: 1.7">
			Your email is used to identify your account and to communicate with you about the
			service. Your saved trades are used to display your portfolio and personalize your
			experience. We do not sell your personal information to third parties.
		</p>
	</section>

	<section>
		<p class="label mb-2">THIRD-PARTY SERVICES</p>
		<p style="color: var(--foreground); line-height: 1.7">
			VEXARIUM works with a limited set of third-party providers to deliver its features:
		</p>
		<ul class="label" style="color: var(--foreground); line-height: 1.9">
			<li>Alpaca — supplies market data used to compute technical indicators.</li>
			<li>Stripe — processes payments when subscription features are released.</li>
			<li>Our LLM provider — powers AI-based analysis of the data you request.</li>
		</ul>
	</section>

	<section>
		<p class="label mb-2">GDPR</p>
		<p style="color: var(--foreground); line-height: 1.7">
			If you are located in the European Economic Area, you have the right to access the
			personal data we hold about you, the right to request correction of inaccurate data, and
			the right to request deletion of your personal data. You may also object to or restrict
			the processing of your data, and you have the right to data portability. To exercise any
			of these rights, contact us using the details below. We process personal data only to the
			extent necessary to provide the service you have requested.
		</p>
	</section>

	<section>
		<p class="label mb-2">CONTACT</p>
		<p style="color: var(--foreground); line-height: 1.7">
			If you have questions about this privacy policy or wish to exercise any of your rights,
			please contact us at the address that will be published here. This contact placeholder
			will be updated with our official support channel.
		</p>
	</section>
</LegalLayout>
