<script lang="ts">
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	let isMenuOpen = false;

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	const currentPath = derived(page, ($page) => $page.url.pathname);
</script>

<nav class="bg-white shadow-md w-full">
	<div class="flex items-center justify-between h-16 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
		<a href="/dashboard" class="flex items-center gap-2 text-xl font-bold text-blue-700 hover:text-blue-900">
			E.M.T.
		</a>

		<div class="hidden md:flex gap-6 items-center">
			<a href="/dashboard" class="px-3 py-2 rounded-md text-sm font-medium transition-colors { $currentPath === '/dashboard' ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-800' }">Dashboard</a>
			<a href="/check-in" class="px-3 py-2 rounded-md text-sm font-medium transition-colors { $currentPath === '/check-in' ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-800' }">Check-in</a>
			<a href="/admin" class="px-3 py-2 rounded-md text-sm font-medium transition-colors { $currentPath === '/admin' ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-800' }">Admin</a>
		</div>

		<button class="md:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Toggle menu" on:click={toggleMenu}>
			{#if isMenuOpen}
				<svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
			{:else}
				<svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
			{/if}
		</button>
	</div>

	{#if isMenuOpen}
		<div class="md:hidden px-2 pt-2 pb-3 space-y-1 bg-white shadow">
			<a href="/dashboard" class="block px-3 py-2 rounded-md text-base font-medium transition-colors { $currentPath === '/dashboard' ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-800' }">Dashboard</a>
			<a href="/check-in" class="block px-3 py-2 rounded-md text-base font-medium transition-colors { $currentPath === '/check-in' ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-800' }">Check-in</a>
			<a href="/admin" class="block px-3 py-2 rounded-md text-base font-medium transition-colors { $currentPath === '/admin' ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-800' }">Admin</a>
		</div>
	{/if}
</nav>
