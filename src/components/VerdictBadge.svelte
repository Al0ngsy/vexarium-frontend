<script lang="ts">
	import type { Verdict } from '$lib/types';
	import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '$lib/verdict';

	let { verdict }: { verdict: Verdict } = $props();
</script>

<span
	class="verdict-badge"
	style="border-left-color: {VERDICT_COLORS[verdict]}; color: {VERDICT_COLORS[verdict]}"
>
	{VERDICT_LABELS[verdict]} {VERDICT_ICONS[verdict]}
</span>
