<script lang="ts">
	import { checkInAttendee, collectKit, collectLunch, fetchAttendees } from '$lib/stores';
	import { onMount } from 'svelte';
	import QrScanner from '../components/QrScanner.svelte';

	let scanMode = $state<'checkin' | 'kit' | 'lunch'>('checkin');
	let manualId = $state('');
	let showScanner = $state(false);
	let scanResult = $state<{
		success: boolean;
		message: string;
	} | null>(null);

	function handleManualScan() {
		if (!manualId.trim()) {
			scanResult = {
				success: false,
				message: 'Please enter a valid ID'
			};
			return;
		}

		processScanResult(manualId);
	}

	function handleQrScan(decodedText: string) {
		processScanResult(decodedText);
		showScanner = false;
	}
	onMount(() => {
		const selectedDate = eventDays[selectedDayIdx].date;
		fetchAttendees(selectedDate);
	});

	const eventDays = [
	  { label: 'Day 1', date: '2025-05-17' },
	  { label: 'Day 2', date: '2025-05-18' },
	  { label: 'Day 3', date: '2025-05-19' }
	];
	let selectedDayIdx = $state(0);

	async function processScanResult(uniqueId: string) {
		let result;
		const selectedDate = eventDays[selectedDayIdx].date;

		switch (scanMode) {
			case 'checkin':
				result = await checkInAttendee(uniqueId, selectedDate);
				break;
			case 'kit':
				result = await collectKit(uniqueId, selectedDate);
				break;
			case 'lunch':
				result = await collectLunch(uniqueId, selectedDate);
				break;
		}

		await fetchAttendees(selectedDate);

		scanResult = {
			success: result.success,
			message: result.message
		};

		if (result.success) {
			manualId = '';

			setTimeout(() => {
				scanResult = null;
			}, 3000);
		}
	}

	function toggleScanner() {
		showScanner = !showScanner;
	}
	async function setScanMode(mode: 'checkin' | 'kit' | 'lunch', dayIdx?: number) {
		scanMode = mode;
		scanResult = null;
		manualId = '';
		if (typeof dayIdx === 'number') {
			selectedDayIdx = dayIdx;
			const selectedDate = eventDays[dayIdx].date;
			await fetchAttendees(selectedDate);
		}
		const input = document.getElementById('manualId') as HTMLInputElement | null;
		if (input) input.value = '';
	}
</script>

<div>
	<h1 class="mb-6 text-3xl font-bold text-gray-800">Attendee Check-in & Distribution</h1>

	<div class="mb-8 rounded-lg border bg-white p-6 shadow-md">
		<h2 class="mb-4 text-xl font-semibold text-gray-700">Scan Mode</h2>

		<div class="flex flex-wrap gap-3">
			<button
				class={`rounded-lg px-4 py-2 font-medium ${scanMode === 'checkin' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
				onclick={() => setScanMode('checkin')}
			>
				Check-in
			</button>

			<button
				class={`rounded-lg px-4 py-2 font-medium ${scanMode === 'kit' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
				onclick={() => setScanMode('kit')}
			>
				Kit Distribution
			</button>

			<button
				class={`rounded-lg px-4 py-2 font-medium ${scanMode === 'lunch' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
				onclick={() => setScanMode('lunch')}
			>
				Lunch Distribution
			</button>
		</div>
	</div>

	<div class="rounded-lg border bg-white p-6 shadow-md">
		<h2 class="mb-4 text-xl font-semibold text-gray-700">
			{#if scanMode === 'checkin'}
				Attendee Check-in
			{:else if scanMode === 'kit'}
				Kit Distribution
			{:else}
				Lunch Distribution
			{/if}
		</h2>

		<div class="flex flex-wrap gap-3 mb-4">
			{#each eventDays as day, i}
				<button
					class={`rounded-lg px-4 py-2 font-medium ${selectedDayIdx === i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
					onclick={() => setScanMode(scanMode, i)}
				>
					{day.label}
				</button>
			{/each}
		</div>

		<!-- QR Scanner FIRST -->
		<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="order-1 md:order-1">
				<h3 class="mb-3 text-lg font-medium text-gray-700">QR Code Scanner</h3>
				{#if !showScanner}
					<button
						onclick={() => { showScanner = true; }}
						class="w-full rounded-lg bg-blue-600 py-2.5 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
					>
						Open QR Scanner
					</button>
				{:else}
					<div class="mb-3">
						<QrScanner on:scan={event => handleQrScan(event.detail)} autostart={true} />
					</div>
					<button
						onclick={() => { showScanner = false; }}
						class="w-full rounded-lg bg-gray-500 py-2.5 text-white hover:bg-gray-600 focus:ring-4 focus:ring-gray-300 focus:outline-none"
					>
						Close Scanner
					</button>
				{/if}
			</div>

			<!-- Manual ID Entry SECOND -->
			<div class="order-2 md:order-2">
				<h3 class="mb-3 text-lg font-medium text-gray-700">Manual Entry</h3>
				<label for="manualId" class="mb-2 block text-sm font-medium text-gray-700">
					Enter Unique ID Manually
				</label>
				<div class="flex">
					<input
						id="manualId"
						type="text"
						bind:value={manualId}
						placeholder="Enter attendee's unique ID"
						class="flex-1 rounded-l-lg border border-gray-300 p-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					/>
					<button
						class="rounded-r-lg bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
						onclick={handleManualScan}
					>
						Submit
					</button>
				</div>
			</div>
		</div>

		{#if scanResult}
			<div
				class={`mb-4 rounded-lg p-4 ${scanResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
			>
				<div class="flex items-center">
					<div class="mr-3">
						{#if scanResult.success}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						{/if}
					</div>
					<div>
						<p class="font-medium">
							{#if scanResult}
								{scanResult.message}
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
