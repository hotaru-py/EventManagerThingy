<script lang="ts">
	import { onMount } from 'svelte';
	import { attendees, fetchAttendees } from '$lib/stores';
	import { parseAttendeeCSV, exportAttendeesToCSV } from '$lib/attendeeUtils';
	import { writable, derived, get } from 'svelte/store';
	import type { Readable } from 'svelte/store';
	import type { Attendee } from '$lib/types';

	let csvFile = writable<File | null>(null);
	let isUploading = writable(false);
	let uploadResult = writable({ success: false, message: '' });
	let searchQuery = writable('');
	let showAddModal = writable(false);
	let showDeleteConfirm = writable<{ show: boolean; attendee: Attendee | null }>({ show: false, attendee: null });
	let newAttendee = writable<Partial<Attendee>>({
		name: '',
		email: '',
		phone: '',
		role: 'Attendee',
		isCheckedIn: false,
		hasCollectedLunch: false,
		hasCollectedKit: false,
	});

	const filteredAttendees: Readable<Attendee[]> = derived(
		[attendees, searchQuery],
		([$attendees, $searchQuery]) => {
			if (!$searchQuery.trim()) {
				return $attendees;
			} else {
				const query = $searchQuery.toLowerCase();
				return $attendees.filter(
					(attendee: Attendee) =>
						attendee.name.toLowerCase().includes(query) ||
						attendee.email.toLowerCase().includes(query) ||
						attendee.phone.toLowerCase().includes(query) ||
						attendee.role.toLowerCase().includes(query) ||
						attendee.uniqueId.toLowerCase().includes(query)
				);
			}
		}
	);
	onMount(async () => {
		await fetchAttendees();
	});

	async function handleFileUpload() {
		if (!$csvFile) {
			$uploadResult = { success: false, message: 'Please select a CSV file first' };
			return;
		}

		$isUploading = true;
		$uploadResult = await parseAttendeeCSV($csvFile);
		$isUploading = false;
	}

	function handleExport() {
		exportAttendeesToCSV();
	}

	function downloadQRCodes() {
		const allQrCodes = $attendees.map((a) => a.qrCode);

		// Open a new window with all QR codes
		const newWindow = window.open('', '_blank');
		if (newWindow) {
			newWindow.document.write(`
				<html>
					<head>
						<title>Attendee QR Codes</title>
						<style>
							body { font-family: Arial, sans-serif; }
							.qr-container { 
								display: grid; 
								grid-template-columns: repeat(3, 1fr); 
								gap: 20px; 
								margin: 20px;
							}
							.qr-item { 
								border: 1px solid #ccc; 
								padding: 15px; 
								text-align: center;
								page-break-inside: avoid;
							}
							.qr-code { width: 200px; height: 200px; margin: 0 auto; }
							@media print {
								.no-print { display: none; }
								.qr-item { page-break-inside: avoid; }
							}
						</style>
					</head>
					<body>
						<div class="no-print" style="text-align: center; margin: 20px;">
							<h1>Attendee QR Codes</h1>
							<p>Print this page to get physical copies of all QR codes</p>
							<button onclick="window.print()">Print QR Codes</button>
						</div>
						<div class="qr-container">							${$attendees
							.map(
								(attendee, i) => `
								<div class="qr-item">
									<h3>${attendee.name}</h3>
									<p>Email: ${attendee.email}</p>
									<p>Phone: ${attendee.phone}</p>
									<p>Role: ${attendee.role}</p>
									<div class="qr-code">
										<img src="${attendee.qrCode}" alt="QR Code for ${attendee.name}" />
									</div>
									<p>Unique ID: ${attendee.uniqueId}</p>
								</div>
							`
							)
							.join('')}
						</div>
					</body>
				</html>
			`);
			newWindow.document.close();
		}
	}

	function debugFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			console.log('File selected:', input.files[0].name);
		} else {
			console.log('No file selected');
		}
	}

	function openAddModal() {
		newAttendee.set({ name: '', email: '', phone: '', role: 'Attendee', isCheckedIn: false, hasCollectedLunch: false, hasCollectedKit: false });
		showAddModal.set(true);
	}

	async function addAttendee() {
		const attendee = get(newAttendee);
		if (!attendee.name || !attendee.email || !attendee.phone || !attendee.role) {
			alert('Please fill all required fields.');
			return;
		}
		const uniqueId = Math.random().toString(36).substr(2, 9).toUpperCase();
		const newAttendeeObj = {
			name: attendee.name,
			email: attendee.email,
			phone: attendee.phone,
			role: attendee.role,
			is_checked_in: attendee.isCheckedIn ?? false,
			has_collected_kit: attendee.hasCollectedKit ?? false,
			has_collected_lunch: attendee.hasCollectedLunch ?? false,
			unique_id: uniqueId,
			qr_code: '', // Generate QR code as needed
		};
		try {
			const response = await fetch('http://localhost:8000/attendees/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newAttendeeObj),
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.detail || 'Failed to add attendee');
			}
			const saved = await response.json();
			attendees.update((list) => [
				{
					name: saved.name,
					email: saved.email,
					phone: saved.phone,
					role: saved.role,
					isCheckedIn: saved.is_checked_in,
					hasCollectedKit: saved.has_collected_kit,
					hasCollectedLunch: saved.hasCollected_lunch,
					uniqueId: saved.unique_id,
					qrCode: saved.qr_code,
				},
				...list,
			]);
			showAddModal.set(false);
		} catch (err) {
			alert('Error adding attendee: ' + err.message);
		}
	}

	function confirmDelete(attendee: Attendee) {
		showDeleteConfirm.set({ show: true, attendee });
	}

	async function deleteAttendee() {
		const { attendee } = get(showDeleteConfirm);
		if (attendee) {
			try {
				const response = await fetch(`http://localhost:8000/attendees/${attendee.uniqueId}`, {
					method: 'DELETE',
				});
				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.detail || 'Failed to delete attendee');
				}
				attendees.update((list) => list.filter((a) => a.uniqueId !== attendee.uniqueId));
			} catch (err) {
				alert('Error deleting attendee: ' + err.message);
			}
		}
		showDeleteConfirm.set({ show: false, attendee: null });
	}

	const eventDays = [
		{ label: 'All attendees', date: 'all' },
		{ label: 'Day 1', date: '2025-05-17' },
		{ label: 'Day 2', date: '2025-05-18' },
		{ label: 'Day 3', date: '2025-05-19' }
	];
	let selectedDayIdx = 0;
	const perDayAttendees = writable([]);
	async function fetchPerDayAttendees(date: string) {
		try {
			if (date === 'all') {
				const allAttendees = get(attendees);
				const formattedAttendees = allAttendees.map(a => ({
					name: a.name,
					email: a.email,
					phone: a.phone,
					role: a.role,
					unique_id: a.uniqueId,
					is_checked_in: a.isCheckedIn,
					has_collected_kit: a.hasCollectedKit,
					has_collected_lunch: a.hasCollectedLunch,
					attendee_id: a.id,
					qr_code: a.qrCode
				}));
				perDayAttendees.set(formattedAttendees);
			} else {
				const res = await fetch(`http://localhost:8000/attendee_events?event_date=${date}`);
				const data = await res.json();
				perDayAttendees.set(data);
			}
		} catch (error) {
			perDayAttendees.set([]);
		}
	}
	$: if (typeof window !== 'undefined' && selectedDayIdx !== undefined) {
		fetchPerDayAttendees(eventDays[selectedDayIdx].date);
	}
</script>

<div>
	<h1 class="mb-6 text-3xl font-bold text-gray-800">Admin Panel</h1>

	<!-- 1. Attendee List -->
	<div class="rounded-lg border bg-white p-6 shadow-md mb-8">
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-gray-700">Attendee List</h2>
			<div class="flex gap-2 items-center">
				<button class="rounded-lg bg-blue-500 px-3 py-2 text-white hover:bg-blue-600" onclick={openAddModal}>
					+ Add Attendee
				</button>
				<div class="relative w-64">
					<input
						type="text"
						placeholder="Search attendees..."
						bind:value={$searchQuery}
						class="w-full rounded-lg border border-gray-300 p-2 pr-8 text-sm"
					/>
					<span class="absolute inset-y-0 right-2 flex items-center"> 🔍 </span>
				</div>
			</div>
		</div>

		<!-- Day Tabs -->
		<div class="mb-4">
			{#each eventDays as day, i}
				<button
					class={`mr-2 rounded-lg px-4 py-2 text-sm font-semibold
					${selectedDayIdx === i
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
					}`}
					onclick={() => { selectedDayIdx = i; }}
				>
					{day.label}
				</button>
			{/each}
		</div>

		{#if $perDayAttendees.length === 0}
			<p class="py-4 text-center text-gray-500">No attendees for this day.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full border-collapse">
					<thead>
						<tr class="border-b bg-gray-50">
							<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Name</th>
							<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Email</th>
							<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Phone</th>
							<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Role</th>
							{#if selectedDayIdx !== 0}
								<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Check In</th>
								<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Lunch</th>
								<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Kit</th>
							{/if}
							<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Unique ID</th>
							<th class="p-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"></th>
						</tr>
					</thead>
					<tbody>
						{#each $perDayAttendees as attendee}
							{#if selectedDayIdx === 0 || attendee.is_checked_in}
							<tr class="border-b hover:bg-gray-50">
								<td class="p-3 text-sm text-gray-700">{attendee.name}</td>
								<td class="p-3 text-sm text-gray-700">{attendee.email}</td>
								<td class="p-3 text-sm text-gray-700">{attendee.phone}</td>
								<td class="p-3 text-sm text-gray-700">
									<span class={`rounded-full px-2 py-1 text-xs font-semibold 
										${attendee.role === 'Speaker'
											? 'bg-blue-100 text-blue-800'
											: attendee.role === 'Organizer'
												? 'bg-purple-100 text-purple-800'
												: 'bg-green-100 text-green-800'
										}`}>{attendee.role}</span>
								</td>
								{#if selectedDayIdx !== 0}
									<td class="p-3 text-sm">
										<span class={`rounded-full px-2 py-1 text-xs font-semibold 
											${attendee.is_checked_in ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{attendee.is_checked_in ? 'Checked In' : 'Not Checked In'}</span>
									</td>
									<td class="p-3 text-sm">
										<span class={`rounded-full px-2 py-1 text-xs font-semibold 
											${attendee.has_collected_lunch ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{attendee.has_collected_lunch ? 'Received' : 'Not Received'}</span>
									</td>
									<td class="p-3 text-sm">
										<span class={`rounded-full px-2 py-1 text-xs font-semibold 
											${attendee.has_collected_kit ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{attendee.has_collected_kit ? 'Received' : 'Not Received'}</span>
									</td>
								{/if}
								<td class="p-3 font-mono text-sm text-gray-700">{attendee.unique_id}</td>
								<td class="p-3 text-sm text-right">
									<button class="text-red-500 hover:text-red-700 font-bold text-lg" title="Delete" onclick={() => confirmDelete(attendee)}>&times;</button>
								</td>
							</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- 2. Attendee Actions -->
	<div class="mb-8 rounded-lg border bg-white p-6 shadow-md">
		<h2 class="mb-4 text-xl font-semibold text-gray-700">Attendee Actions</h2>
		<div class="flex flex-wrap gap-4">
			<button
				onclick={handleExport}
				disabled={$attendees.length === 0}
				class="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
			>
				Export Attendees to CSV
			</button>
			<button
				onclick={downloadQRCodes}
				disabled={$attendees.length === 0}
				class="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:bg-gray-400"
			>
				Download QR Codes
			</button>
		</div>
	</div>

	<!-- 3. Import Attendees -->
	<div class="mb-8 rounded-lg border bg-white p-6 shadow-md">
		<h2 class="mb-4 text-xl font-semibold text-gray-700">Import Attendees</h2>
		<div class="mb-4">
			<label for="csvFile" class="mb-2 block text-sm font-medium text-gray-700">
				Upload CSV file with attendee data
			</label>
			<input
				id="csvFile"
				type="file"
				accept=".csv"
				onchange={(e) => {
					csvFile.set(e.target.files ? e.target.files[0] : null);
					debugFileInput(e);
				}}
				class="block w-full rounded-lg border border-gray-300 text-sm text-gray-900"
			/>
			<p class="mt-2 text-sm text-gray-500">
				Expected format: CSV with headers "Name,Email,Phone,Role"
				<a
					href="/event_attendees_sample.csv"
					class="ml-1 text-blue-600 hover:underline"
					target="_blank"
					download
				>
					Download sample CSV
				</a>
			</p>
		</div>
		<button
			onclick={handleFileUpload}
			disabled={$isUploading || !$csvFile}
			class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
		>
			{$isUploading ? 'Uploading...' : 'Upload and Process'}
		</button>
		{#if $uploadResult.message}
			<div
				class={`mt-4 rounded-lg p-3 ${$uploadResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
			>
				{$uploadResult.message}
			</div>
		{/if}
	</div>

	<!-- Add Attendee Modal -->
	{#if $showAddModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.7);">
			<div class="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
				<h3 class="text-lg font-semibold mb-4">Add New Attendee</h3>
				<div class="space-y-3">
					<input class="w-full border rounded p-2" placeholder="Name" bind:value={$newAttendee.name} />
					<input class="w-full border rounded p-2" placeholder="Email" bind:value={$newAttendee.email} />
					<input class="w-full border rounded p-2" placeholder="Phone" bind:value={$newAttendee.phone} />
					<select class="w-full border rounded p-2" bind:value={$newAttendee.role}>
						<option value="Attendee">Attendee</option>
						<option value="Speaker">Speaker</option>
						<option value="Organizer">Organizer</option>
					</select>
					<div class="flex gap-4">
						<label><input type="checkbox" bind:checked={$newAttendee.isCheckedIn} /> Checked In</label>
						<label><input type="checkbox" bind:checked={$newAttendee.hasCollectedLunch} /> Lunch Received</label>
						<label><input type="checkbox" bind:checked={$newAttendee.hasCollectedKit} /> Kit Received</label>
					</div>
				</div>
				<div class="mt-6 flex justify-end gap-2">
					<button class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onclick={() => showAddModal.set(false)}>Cancel</button>
					<button class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onclick={addAttendee}>Add</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if $showDeleteConfirm.show}
		<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.7);">
			<div class="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg">
				<h3 class="text-lg font-semibold mb-4">Delete Attendee</h3>
				<p>Are you sure you want to delete <span class="font-bold">{$showDeleteConfirm.attendee?.name}</span>?</p>
				<div class="mt-6 flex justify-end gap-2">
					<button class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onclick={() => showDeleteConfirm.set({ show: false, attendee: null })}>Cancel</button>
					<button class="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onclick={deleteAttendee}>Delete</button>
				</div>
			</div>
		</div>
	{/if}
</div>
