<script lang="ts">
	// Labelled input for the auth and account forms. `hint` is wired to the
	// input with aria-describedby.
	let {
		id,
		label,
		type = 'text',
		autocomplete,
		value = $bindable(''),
		hint,
		minlength,
		required = true,
		disabled = false,
		inputRef = $bindable<HTMLInputElement | undefined>()
	}: {
		id: string;
		label: string;
		type?: 'text' | 'email' | 'password';
		autocomplete: 'email' | 'current-password' | 'new-password';
		value?: string;
		hint?: string;
		minlength?: number;
		required?: boolean;
		disabled?: boolean;
		inputRef?: HTMLInputElement;
	} = $props();
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	<input
		{id}
		class="input"
		{type}
		{autocomplete}
		{minlength}
		{required}
		{disabled}
		bind:value
		bind:this={inputRef}
		aria-describedby={hint ? `${id}-hint` : undefined}
		autocapitalize="none"
		spellcheck="false"
	/>
	{#if hint}
		<span class="hint" id="{id}-hint">{hint}</span>
	{/if}
</div>
