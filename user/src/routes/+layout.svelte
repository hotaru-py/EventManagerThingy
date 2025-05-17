<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="layout-center">
	{@render children()}
</div>

<style>
	.layout-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100vw;
		min-height: 100vh;
		gap: 2.2rem;
	}
</style>
