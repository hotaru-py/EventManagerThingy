<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { createEventDispatcher } from 'svelte';

	export let width: string = '300px';
	export let height: string = '300px';
	export let autostart: boolean = false;

	const dispatch = createEventDispatcher();

	let html5QrCode: Html5Qrcode | null = null;
	let qrScanner: HTMLDivElement;
	let scanning = false;
	let cameraId = '';
	let cameras: Array<{ id: string; label: string }> = [];

	onMount(async () => {
		try {
			html5QrCode = new Html5Qrcode('qr-reader');

			const devices = await Html5Qrcode.getCameras();
			if (devices && devices.length) {
				cameras = devices;
				cameraId = devices[0].id;
				
				if (autostart && cameraId) {
					setTimeout(() => startScanner(), 500);
				}
			}
		} catch (error) {
			console.error('Error initializing QR scanner:', error);
		}
	});

	onDestroy(() => {
		if (html5QrCode && scanning) {
			html5QrCode.stop().catch((error) => {
				console.error('Error stopping QR code scanner:', error);
			});
		}
	});

	async function startScanner() {
		if (!html5QrCode || !cameraId) return;

		try {
			scanning = true;
			await html5QrCode.start(
				cameraId,
				{
					fps: 10,
					qrbox: { width: 250, height: 250 }
				},
				(decodedText) => {
					try {
						const jsonData = JSON.parse(decodedText);
						if (jsonData.uniqueId) {
							dispatch('scan', jsonData.uniqueId);
						} else {
							dispatch('scan', decodedText);
						}
					} catch (e) {
						dispatch('scan', decodedText);
					}
					stopScanner();
				},
				(errorMessage) => {
					console.log(errorMessage);
				}
			);
		} catch (error) {
			console.error('Error starting QR code scanner:', error);
			scanning = false;
		}
	}

	async function stopScanner() {
		if (!html5QrCode || !scanning) return;

		try {
			await html5QrCode.stop();
			scanning = false;
		} catch (error) {
			console.error('Error stopping QR code scanner:', error);
		}
	}

	function handleCameraChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		cameraId = select.value;

		if (scanning) {
			stopScanner().then(() => {
				if (cameraId) startScanner();
			});
		}
	}
</script>

<div class="qr-scanner-container">
	<div id="qr-reader" style="width: {width}; height: {height};" bind:this={qrScanner}></div>

	<div class="mt-4 flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
		{#if cameras.length > 0}
			<div class="w-full sm:w-auto">
				<label for="camera-select" class="mb-1 block text-sm font-medium text-gray-700">
					Select Camera
				</label>
				<select
					id="camera-select"
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					bind:value={cameraId}
					on:change={handleCameraChange}
				>
					{#each cameras as camera}
						<option value={camera.id}>{camera.label || `Camera ${camera.id}`}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="flex space-x-2">
			{#if !scanning}
				<button
					on:click={startScanner}
					class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					Start Scanner
				</button>
			{:else}
				<button
					on:click={stopScanner}
					class="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
				>
					Stop Scanner
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(#qr-reader) {
		width: 100%;
		border-radius: 0.375rem;
		overflow: hidden;
		border: 1px solid #e5e7eb;
	}
	:global(#qr-reader__status_span) {
		background-color: #3b82f6 !important;
		color: white !important;
	}
	:global(#qr-reader__dashboard_section_csr button) {
		background-color: #3b82f6 !important;
		border: none !important;
		color: white !important;
		border-radius: 0.375rem !important;
		padding: 0.5rem 1rem !important;
	}
</style>
