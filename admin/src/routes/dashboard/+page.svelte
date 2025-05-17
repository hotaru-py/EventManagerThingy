<script lang="ts">
	import { attendees, fetchAttendees } from '$lib/stores';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import jsPDF from 'jspdf';

	interface Attendee {
		name: string;
		is_checked_in: boolean;
		has_collected_kit: boolean;
		has_collected_lunch: boolean;
		unique_id?: string;
		uniqueId?: string;
		role?: string;
		registrationTime?: string;
		checkinTime?: string;
		kitTime?: string;
		lunchTime?: string;
	}

	type EventDay = { label: string; date: string };
	const eventDays: EventDay[] = [
		{ label: 'Day 1', date: '2025-05-17' },
		{ label: 'Day 2', date: '2025-05-18' },
		{ label: 'Day 3', date: '2025-05-19' }
	];
	let selectedDayIdx = 0;
	const perDayAttendees = writable<Attendee[]>([]);

	async function fetchPerDayAttendees(date: string) {
		try {
			const res = await fetch(
				`http://localhost:8000/attendee_events?event_date=${date}`
			);
			perDayAttendees.set(await res.json());
		} catch (err) {
			console.error('Error fetching per-day attendees:', err);
			perDayAttendees.set([]);
		}
	}

	onMount(() => {
		fetchAttendees();
		if (typeof window !== 'undefined') {
			fetchPerDayAttendees(eventDays[selectedDayIdx].date);
		}
	});

	$: if (typeof window !== 'undefined' && selectedDayIdx !== undefined) {
		fetchPerDayAttendees(eventDays[selectedDayIdx].date);
	}

	let activityTab: 'checkin' | 'kit' | 'lunch' = 'checkin';

	$: allActivities = [...$perDayAttendees]
		.filter((a) => a.is_checked_in || a.has_collected_kit || a.has_collected_lunch)
		.sort((a, b) => {
			const getLatest = (x: Attendee) => {
				const times = [x.registrationTime, x.checkinTime, x.kitTime, x.lunchTime]
					.filter(Boolean)
					.map((t) => new Date(t).getTime());
				return times.length ? Math.max(...times) : 0;
			};
			return getLatest(a) - getLatest(b);
		})
		.reverse();

	$: filteredActivities =
		activityTab === 'checkin'
			? allActivities.filter((a) => a.is_checked_in)
			: activityTab === 'kit'
			? allActivities.filter((a) => a.has_collected_kit)
			: allActivities.filter((a) => a.has_collected_lunch);

	$: dayStats = (() => {
		const attendees = Array.isArray($perDayAttendees) ? $perDayAttendees as any[] : [];
		const checkedIn = attendees.filter(a => a && a.is_checked_in).length;
		const kitsDistributed = attendees.filter(a => a && a.has_collected_kit).length;
		const lunchDistributed = attendees.filter(a => a && a.has_collected_lunch).length;
		const attendeeCount = attendees.filter(a => a && a.role && a.role.toLowerCase() === 'attendee').length;
		const speakerCount = attendees.filter(a => a && a.role && a.role.toLowerCase() === 'speaker').length;
		const organizerCount = attendees.filter(a => a && a.role && a.role.toLowerCase() === 'organizer').length;
		return {
			checkedIn,
			kitsDistributed,
			lunchDistributed,
			attendeeCount,
			speakerCount,
			organizerCount,
			totalAttendees: attendees.length
		};
	})();

	$: totalAttendees = Array.isArray($attendees) ? $attendees.length : 0;	let isExporting = false;
	let exportMessage = '';
	let showExportNotification = false;	async function exportDayStatsPDF() {
		exportMessage = 'Preparing export...';
		showExportNotification = true;
		isExporting = true;
		const originalDayIdx = selectedDayIdx;

		try {
			const doc = new jsPDF({
				orientation: 'portrait',
				unit: 'px'
			});

			doc.setFontSize(22);
			doc.text("Event Statistics Summary", 105, 30, { align: 'center' });

			let yOffset = 50;
			for (let i = 0; i < eventDays.length; i++) {
				exportMessage = `Processing ${eventDays[i].label} statistics (${i+1}/${eventDays.length})...`;
				selectedDayIdx = i;
				await new Promise(resolve => setTimeout(resolve, 800));

				const stats = (() => {
					const attendees = Array.isArray($perDayAttendees) ? $perDayAttendees as any[] : [];
					const checkedIn = attendees.filter(a => a && a.is_checked_in).length;
					const kitsDistributed = attendees.filter(a => a && a.has_collected_kit).length;
					const lunchDistributed = attendees.filter(a => a && a.has_collected_lunch).length;
					const attendeeCount = attendees.filter(a => a && a.role && a.role.toLowerCase() === 'attendee').length;
					const speakerCount = attendees.filter(a => a && a.role && a.role.toLowerCase() === 'speaker').length;
					const organizerCount = attendees.filter(a => a && a.role && a.role.toLowerCase() === 'organizer').length;
					return {
						checkedIn,
						kitsDistributed,
						lunchDistributed,
						attendeeCount,
						speakerCount,
						organizerCount,
						totalAttendees: attendees.length
					};
				})();

				doc.setFontSize(16);
				doc.text(`${eventDays[i].label} (${eventDays[i].date})`, 20, yOffset);
				yOffset += 18;
				doc.setFontSize(12);
				doc.text(`Total Attendees: ${stats.totalAttendees}`, 30, yOffset); yOffset += 14;
				doc.text(`Checked In: ${stats.checkedIn}`, 30, yOffset); yOffset += 14;
				doc.text(`Kits Distributed: ${stats.kitsDistributed}`, 30, yOffset); yOffset += 14;
				doc.text(`Lunch Distributed: ${stats.lunchDistributed}`, 30, yOffset); yOffset += 14;
				doc.text(`Attendees: ${stats.attendeeCount}`, 30, yOffset); yOffset += 14;
				doc.text(`Speakers: ${stats.speakerCount}`, 30, yOffset); yOffset += 14;
				doc.text(`Organizers: ${stats.organizerCount}`, 30, yOffset); yOffset += 20;

				if (i < eventDays.length - 1 && yOffset > doc.internal.pageSize.getHeight() - 60) {
					doc.addPage();
					yOffset = 30;
				}
			}

			doc.setFontSize(12);
			doc.text(`Report generated on ${new Date().toLocaleDateString()}`, 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
			doc.save(`EventStats_Complete_Summary.pdf`);

			selectedDayIdx = originalDayIdx;
			isExporting = false;
			exportMessage = 'Export completed! File saved as EventStats_Complete_Summary.pdf';
			setTimeout(() => {
				showExportNotification = false;
			}, 5000);
		} catch (error) {
			console.error('Error during export:', error);
			exportMessage = `Export failed: ${error.message || 'Unknown error'}`;
			isExporting = false;
			setTimeout(() => {
				showExportNotification = false;
			}, 8000);
		}
	}
</script>

<div>
	<h1 class="mb-6 text-3xl font-bold text-gray-800">Event Dashboard</h1>
	{#if showExportNotification}
		<div class="fixed top-5 right-5 {exportMessage.includes('failed') ? 'bg-red-600' : isExporting ? 'bg-blue-600' : 'bg-green-600'} text-white px-6 py-3 rounded-md shadow-lg z-50 flex items-center transition-all duration-300">
			<div class="mr-3">
				{#if isExporting}
					<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
			</div>
			<span>{exportMessage}</span>
			<button 
				class="ml-3 text-white opacity-70 hover:opacity-100 focus:outline-none"
				on:click={() => showExportNotification = false}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}
	<div class="mb-6 flex gap-2 items-center">
		{#each eventDays as day, i}			<button
				class="px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 {selectedDayIdx === i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}"
				on:click={() => (selectedDayIdx = i)}
				disabled={isExporting}
			>
				{day.label}
			</button>
		{/each}		<button 
			class="ml-4 px-4 py-2 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center" 
			on:click={exportDayStatsPDF}
			disabled={isExporting}
		>
			{#if isExporting}
				<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Exporting...
			{:else}
				Export All Days (PDF)
			{/if}
		</button>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-7 gap-6 min-h-[60vh] w-full">
		<div class="stats-section flex flex-col gap-6 lg:col-span-2 min-w-[320px] max-w-[400px] h-full">
			<div class="rounded-lg border bg-white p-6 shadow-md">
				<div class="flex items-center">
					<div class="mr-4 rounded-full bg-blue-100 p-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-500">Total Attendees</p>
						<p class="text-2xl font-bold text-gray-800">{totalAttendees}</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg border bg-white p-6 shadow-md">
				<div class="flex items-center flex-wrap gap-y-2">
					<div class="mr-4 rounded-full bg-green-100 p-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-500">Checked In</p>
						<p class="text-2xl font-bold text-gray-800">{dayStats.checkedIn}</p>
						<p class="text-xs text-gray-500">{totalAttendees > 0 ? Math.round((dayStats.checkedIn / totalAttendees) * 100) : 0}% of total attendees</p>
						<div class="mt-2 flex flex-wrap gap-2 text-xs">
							<span class="bg-green-100 text-green-800 rounded px-2 py-1">Attendees: {dayStats.attendeeCount}</span>
							<span class="bg-blue-100 text-blue-800 rounded px-2 py-1">Speakers: {dayStats.speakerCount}</span>
							<span class="bg-purple-100 text-purple-800 rounded px-2 py-1">Organizers: {dayStats.organizerCount}</span>
						</div>
					</div>
				</div>
			</div>

			<div class="rounded-lg border bg-white p-6 shadow-md">
				<div class="flex items-center">
					<div class="mr-4 rounded-full bg-purple-100 p-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-500">Kits Distributed</p>
						<p class="text-2xl font-bold text-gray-800">{dayStats.kitsDistributed}</p>
						<p class="text-xs text-gray-500">{dayStats.checkedIn > 0 ? Math.round((dayStats.kitsDistributed / dayStats.checkedIn) * 100) : 0}% of checked-in</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg border bg-white p-6 shadow-md">
				<div class="flex items-center">
					<div class="mr-4 rounded-full bg-amber-100 p-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-gray-500">Lunch Distributed</p>
						<p class="text-2xl font-bold text-gray-800">{dayStats.lunchDistributed}</p>
						<p class="text-xs text-gray-500">{dayStats.checkedIn > 0 ? Math.round((dayStats.lunchDistributed / dayStats.checkedIn) * 100) : 0}% of checked-in</p>
					</div>
				</div>
			</div>
		</div>

		<div class="flex flex-col lg:flex-row gap-6 lg:col-span-5 h-full w-full">
			<div class="rounded-lg border bg-white p-6 shadow-md flex-[2_2_0%] flex flex-col justify-start min-w-0 h-full">
				<h2 class="text-xl font-semibold text-gray-700 mb-2">Event Progress</h2>
				<div class="space-y-8 mt-0">
					<div>
						<h3 class="text-md font-semibold text-gray-600 mb-2">Out of All Attendees</h3>
						<div class="mb-3 flex justify-between">
							<span class="text-sm font-medium text-gray-700">Check-in Progress</span>
							<span class="text-sm font-medium text-gray-700">{totalAttendees > 0 ? Math.round((dayStats.checkedIn / totalAttendees) * 100) : 0}%</span>
						</div>
						<div class="h-2.5 w-full rounded-full bg-gray-200 mb-2">
							<div
								class="h-2.5 rounded-full bg-green-600"
								style="width: {totalAttendees > 0 ? Math.round((dayStats.checkedIn / totalAttendees) * 100) : 0}%"
							></div>
						</div>
						<div class="mb-3 flex justify-between">
							<span class="text-sm font-medium text-gray-700">Kit Distribution</span>
							<span class="text-sm font-medium text-gray-700">{totalAttendees > 0 ? Math.round((dayStats.kitsDistributed / totalAttendees) * 100) : 0}%</span>
						</div>
						<div class="h-2.5 w-full rounded-full bg-gray-200 mb-2">
							<div
								class="h-2.5 rounded-full bg-purple-600"
								style="width: {totalAttendees > 0 ? Math.round((dayStats.kitsDistributed / totalAttendees) * 100) : 0}%"
							></div>
						</div>
						<div class="mb-3 flex justify-between">
							<span class="text-sm font-medium text-gray-700">Lunch Distribution</span>
							<span class="text-sm font-medium text-gray-700">{totalAttendees > 0 ? Math.round((dayStats.lunchDistributed / totalAttendees) * 100) : 0}%</span>
						</div>
						<div class="h-2.5 w-full rounded-full bg-gray-200">
							<div
								class="h-2.5 rounded-full bg-amber-600"
								style="width: {totalAttendees > 0 ? Math.round((dayStats.lunchDistributed / totalAttendees) * 100) : 0}%"
							></div>
						</div>
					</div>

					<div class="mt-8">
						<h3 class="text-md font-semibold text-gray-600 mb-2">Out of Checked-in</h3>
						<div class="mb-3 flex justify-between">
							<span class="text-sm font-medium text-gray-700">Kit Distribution</span>
							<span class="text-sm font-medium text-gray-700">{dayStats.checkedIn > 0 ? Math.round((dayStats.kitsDistributed / dayStats.checkedIn) * 100) : 0}%</span>
						</div>
						<div class="h-2.5 w-full rounded-full bg-gray-200 mb-2">
							<div
								class="h-2.5 rounded-full bg-purple-600"
								style={`width: ${dayStats.checkedIn > 0 ? Math.round((dayStats.kitsDistributed / dayStats.checkedIn) * 100) : 0}%`}
							></div>
						</div>
						<div class="mb-3 flex justify-between">
							<span class="text-sm font-medium text-gray-700">Lunch Distribution</span>
							<span class="text-sm font-medium text-gray-700">{dayStats.checkedIn > 0 ? Math.round((dayStats.lunchDistributed / dayStats.checkedIn) * 100) : 0}%</span>
						</div>
						<div class="h-2.5 w-full rounded-full bg-gray-200">
							<div
								class="h-2.5 rounded-full bg-amber-600"
								style={`width: ${dayStats.checkedIn > 0 ? Math.round((dayStats.lunchDistributed / dayStats.checkedIn) * 100) : 0}%`}
							></div>
						</div>
					</div>
				</div>
			</div>

			<div class="rounded-lg border bg-white p-6 shadow-md flex-1 flex flex-col min-w-0 max-w-xl xl:max-w-md h-full">
				<h2 class="mb-4 text-xl font-semibold text-gray-700">Recent Activity</h2>
				<div class="mb-4 flex space-x-2">
					<button
						class="px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
						class:!bg-blue-600={activityTab === 'checkin'}
						class:!text-white={activityTab === 'checkin'}
						class:bg-gray-200={activityTab !== 'checkin'}
						class:text-gray-700={activityTab !== 'checkin'}						on:click={() => (activityTab = 'checkin')}
					>
						Check-in
					</button>
					<button
						class="px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
						class:!bg-purple-600={activityTab === 'kit'}
						class:!text-white={activityTab === 'kit'}
						class:bg-gray-200={activityTab !== 'kit'}
						class:text-gray-700={activityTab !== 'kit'}
						on:click={() => (activityTab = 'kit')}
					>
						Kits
					</button>
					<button
						class="px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
						class:!bg-amber-600={activityTab === 'lunch'}
						class:!text-white={activityTab === 'lunch'}
						class:bg-gray-200={activityTab !== 'lunch'}
						class:text-gray-700={activityTab !== 'lunch'}
						on:click={() => (activityTab = 'lunch')}
					>
						Lunch
					</button>
				</div>
				<div class="max-h-80 min-h-80 overflow-y-auto">
					{#if filteredActivities.length === 0}
						<p class="py-4 text-center text-gray-500">No activity</p>
					{:else}
						<div class="space-y-4">
							{#each filteredActivities as activity, i}
								<div class="flex items-start border-b border-gray-100 pb-3">
									<div class="mr-3 rounded-full bg-blue-100 p-2">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
										</svg>
									</div>
									<div>
										<p class="text-sm font-medium text-gray-800">{activity.name ?? 'Unknown'}</p>
										<p class="text-xs text-gray-500">{activity.unique_id ?? activity.uniqueId ?? 'No UUID'}</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
