<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getAttendeeByUUID } from '../lib/attendeeUtils';
	import QRCode from 'qrcode';
	import html2canvas from 'html2canvas';

	let uuid: string = '';
	let attendee: any = null;
	let qrCodeUrl: string = '';
	let error: string = '';
	let showLogin = false;
	let loginInput: string = '';
	let refreshInterval: any = null;
	let selectedDay: string = '2025-05-17';
	
	function saveUuidToStorage(id: string) {
		localStorage.setItem('attendee_uuid', id);
	}
	
	function getUuidFromStorage(): string | null {
		return localStorage.getItem('attendee_uuid');
	}
	
	function clearUuidFromStorage() {
		localStorage.removeItem('attendee_uuid');
	}
	
	const eventDays = [
		{ date: '2025-05-17', label: 'Day 1', color: '#3b5678' },
		{ date: '2025-05-18', label: 'Day 2', color: '#2c6e31' },
		{ date: '2025-05-19', label: 'Day 3', color: '#923535' }
	];

	function getColorScheme(date: string) {
		const day = eventDays.find(d => d.date === date);
		return {
			bgColor: day?.color || '#3b5678',
			textColor: '#fff'
		};
	}

	async function fetchAttendee() {
		try {
			const basicInfo = await getAttendeeByUUID(uuid);
			console.log('Basic info:', basicInfo);
			if (basicInfo) {
				const perDayData = await getAttendeeByUUID(uuid, selectedDay);
				console.log('Per-day data:', perDayData);
				attendee = perDayData;
				if (!attendee) {
					attendee = {
						...basicInfo,
						is_checked_in: false,
						has_collected_lunch: false,
						has_collected_kit: false,
						event_date: selectedDay
					};
				}
				qrCodeUrl = await QRCode.toDataURL(JSON.stringify({ uniqueId: uuid }));
				error = '';
			} else {
				error = 'Attendee not found.';
			}
		} catch (e: any) {
			error = e.message || 'Unknown error';
		}
	}

	$: if (selectedDay && uuid) {
		fetchAttendee();
	}

	onMount(async () => {
		uuid = new URLSearchParams(window.location.search).get('uuid') || getUuidFromStorage() || '';
		if (!uuid) {
			showLogin = true;
			return;
		}
		saveUuidToStorage(uuid);
		await fetchAttendee();
		refreshInterval = setInterval(fetchAttendee, 2000);
	});

	function handleLogin(submittedUuid: string) {
		uuid = submittedUuid;
		showLogin = false;
		saveUuidToStorage(uuid);
		fetchAttendee();
		if (refreshInterval) clearInterval(refreshInterval);
		refreshInterval = setInterval(fetchAttendee, 2000);
	}

	function handleLogout() {
		clearUuidFromStorage();
		uuid = '';
		attendee = null;
		showLogin = true;
		if (refreshInterval) clearInterval(refreshInterval);
	}

	async function downloadTicketAsPng() {
		const ticketElem = document.querySelector('.ticket') as HTMLElement;
		if (!ticketElem) return;
		const canvas = await html2canvas(ticketElem, { backgroundColor: null });
		const link = document.createElement('a');
		link.download = `${attendee.name || 'ticket'}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
	});
</script>

{#if showLogin}
	<div class="login-overlay">
		<form class="login-form" on:submit|preventDefault={() => handleLogin(loginInput)}>
			<h2>Attendee Login</h2>
			<input
				type="text"
				placeholder="Enter your attendee UUID"
				bind:value={loginInput}
				required
				autofocus
			/>
			<button type="submit">Login</button>
		</form>
	</div>
{:else if error}
	<div class="error">{error}</div>
{:else if attendee}
	<div class="day-tabs">
		{#each eventDays as day}
			<button
				class="day-tab {selectedDay === day.date ? 'active' : ''}"
				style="--tab-color: {day.color}"
				on:click={() => selectedDay = day.date}
			>
				{day.label}
			</button>
		{/each}
	</div>
	<div class="ticket">
		<div class="ticket-header">
			<h2>{attendee.name}</h2>
			<div class="role">{attendee.role}</div>
			<div class="day-label" style="color: {getColorScheme(selectedDay).bgColor}">{eventDays.find(d => d.date === selectedDay)?.label}</div>
		</div>
		<div class="ticket-qr-bg" style="background: {getColorScheme(selectedDay).bgColor}">
			<div class="qr-section">
				{#if qrCodeUrl}
					<img src={qrCodeUrl} alt="QR Code" class="qr" />
				{/if}
			</div>
			<div class="uuid-on-blue">{attendee.unique_id}</div>
		</div>
		<div class="status-section">
			<div class="status-box">
				<div class="status-label">Checked in</div>
				<div class="status-square" style="--accent-color: {getColorScheme(selectedDay).bgColor}">
					{#if attendee.is_checked_in}
						<span style="font-size:1.7rem;color:var(--accent-color)">✔</span>
					{:else}
						<span style="font-size:1.7rem;color:#bbb">✗</span>
					{/if}
				</div>
			</div>
			<div class="status-box">
				<div class="status-label">Lunch</div>
				<div class="status-square" style="--accent-color: {getColorScheme(selectedDay).bgColor}">
					{#if attendee.has_collected_lunch}
						<span style="font-size:1.7rem;color:var(--accent-color)">✔</span>
					{:else}
						<span style="font-size:1.7rem;color:#bbb">✗</span>
					{/if}
				</div>
			</div>
			<div class="status-box">
				<div class="status-label">Kit</div>
				<div class="status-square" style="--accent-color: {getColorScheme(selectedDay).bgColor}">
					{#if attendee.has_collected_kit}
						<span style="font-size:1.7rem;color:var(--accent-color)">✔</span>
					{:else}
						<span style="font-size:1.7rem;color:#bbb">✗</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
	<div class="ticket-actions-row">
		<button class="logout-btn" on:click={handleLogout} aria-label="Logout">Logout</button>
		<button class="download-btn-icon" on:click={downloadTicketAsPng} aria-label="Download Ticket">
			<img src="/dl.webp" alt="Download" width="28" height="28" />
		</button>
	</div>
{:else}
	<div>Loading...</div>
{/if}

<style>
	.ticket {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 96vw;
		max-width: 420px;
		margin: 4vw auto 0 auto;
		box-shadow: 0 4px 24px #0002;
		border: 2px solid #d1d5db;
		min-height: 440px;
		padding: 0;
		position: relative;
		overflow: visible;
	}
	.ticket-header {
		width: 100%;
		padding: 2.2rem 1.5rem 1rem 1.5rem;
		text-align: left;
	}
	.ticket-header h2 {
		margin: 0 0 0.2rem 0;
		font-size: 2.2rem;
		font-weight: 600;
		color: #1a365d;
		letter-spacing: 0.01em;
	}
	.ticket-header .role {
		color: #222;
		font-size: 1.1rem;
		font-weight: 400;
	}
	.ticket-qr-bg {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.2rem 1.2rem 1.2rem 1.2rem;
		position: relative;
	}
	.qr-section {
		background: #fff;
		border-radius: 16px;
		box-shadow: 0 2px 8px #0001;
		padding: 1rem 1rem 0.7rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.7rem;
	}
	.qr {
		width: 160px;
		height: 160px;
		background: #fff;
		border-radius: 12px;
	}
	.uuid-on-blue {
		font-size: 0.68rem;
		color: #fff;
		background: rgba(255, 255, 255, 0.13);
		border-radius: 8px;
		padding: 0.14rem 0.7rem;
		font-family: 'Fira Mono', monospace;
		margin: 1.2rem auto 0 auto;
		display: block;
		text-align: center;
		width: fit-content;
		box-shadow: 0 2px 8px #0001;
		position: relative;
		z-index: 2;
	}
	.status-section {
		width: 100%;
		background: #fff;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 0.7rem;
		padding: 1.2rem 0.7rem 0.7rem 0.7rem;
		box-shadow: 0 2px 8px #0001;
		margin-top: 0;
		position: relative;
		z-index: 3;
		margin-bottom: 0;
		padding-bottom: 2.2rem;
	}
	.status-box {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.status-label {
		font-size: 1.05rem;
		color: #222;
		margin-bottom: 0.2rem;
		text-align: center;
	}
	.status-square {
		width: 48px;
		height: 48px;
		border: 2px solid #222;
		border-radius: 8px;
		background: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		color: #222;
		--accent-color: #3b5678;
	}
	.status-square span {
		font-size: 1.7rem;
	}
	.ticket-actions-row {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		max-width: 420px;
		margin: 0.5rem auto 0 auto;
		padding: 0 0.5rem;
		gap: 1rem;
		margin-top: -1.2rem;
	}
	.error {
		color: #b00;
		background: #ffd6d6;
		padding: 1rem;
		border-radius: 8px;
		max-width: 400px;
		margin: 2rem auto;
		text-align: center;
	}
	.login-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(30, 41, 59, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	.login-form {
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 8px 32px #0002;
		padding: 2.5rem 2rem 2rem 2rem;
		min-width: 320px;
		max-width: 90vw;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
	}
	.login-form h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #1a365d;
		font-weight: 700;
	}
	.login-form input[type='text'] {
		width: 100%;
		padding: 0.7rem 1rem;
		border-radius: 10px;
		border: 1.5px solid #b6c2d1;
		font-size: 1.1rem;
	}
	.login-form input[type='text']:focus {
		border-color: #1a365d;
	}
	.login-form button {
		background: #1a365d;
		color: #fff;
		border: none;
		border-radius: 10px;
		padding: 0.7rem 2.2rem;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 8px #0001;
	}
	.login-form button:hover {
		background: #3b82f6;
	}
	.day-tabs {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin: 1rem auto;
		max-width: 420px;
		padding: 0 1rem;
	}
	.day-tab {
		flex: 1;
		padding: 0.5rem 1rem;
		border: none;
		background: #fff;
		color: var(--tab-color);
		border: 2px solid var(--tab-color);
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
	}
	.day-tab.active {
		background: var(--tab-color);
		color: white;
	}
	.day-label {
		font-size: 0.9rem;
		font-weight: 600;
		margin-top: 0.3rem;
	}
	@media (min-width: 700px) {
		.ticket {
			display: flex;
			flex-direction: row;
			max-width: 900px;
			min-width: 420px;
			min-height: 340px;
			margin: 2rem auto;
			box-shadow: 0 8px 32px #0002;
			background: linear-gradient(135deg, #f8fafc 60%, #e0e7ef 100%);
			border: 2px solid #d1d5db;
			align-items: stretch;
		}
		.ticket-header {
			flex: 1;
			min-width: 220px;
			max-width: 320px;
			background: #eaf3ff;
			padding: 2.5rem 2rem 2rem 2.5rem;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: flex-start;
			text-align: left;
		}
		.ticket-qr-bg {
			flex: 1.2;
			background: #3b5678;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 320px;
			padding: 2.5rem 4rem 2.5rem 4rem;
			position: relative;
			z-index: 1;
		}
		.status-section {
			flex: 0 0 170px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			background: #fff;
			border-left: 2px solid #d1d5db;
			padding: 2.5rem 0.7rem 2.5rem 0.7rem;
			gap: 1.2rem;
			min-width: 140px;
			max-width: 200px;
			z-index: 2;
		}
		.qr-section {
			padding: 2rem 2rem 1.2rem 2rem;
			gap: 1.2rem;
		}
		.qr {
			width: 180px;
			height: 180px;
		}
		.uuid-on-blue {
			margin: 2.2rem auto 0 auto;
			font-size: 0.68rem;
			padding: 0.14rem 0.7rem;
		}
	}
</style>
