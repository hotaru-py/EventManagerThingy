<script lang="ts">
	import '../app.css';
	import Navbar from './components/Navbar.svelte';
	import { onMount } from 'svelte';
	import { loadAttendeesFromStorage } from '$lib/attendeeUtils';

	let { children } = $props();

	onMount(() => {
		loadAttendeesFromStorage();
	});
</script>

<div class="min-h-screen bg-gray-50">
	<Navbar />

	<main class="container mx-auto mt-4 p-4">
		{@render children()}
	</main>
</div>
