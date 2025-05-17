import { writable, derived } from 'svelte/store';
import type { Attendee, EventStats } from './types';

export const attendees = writable<Attendee[]>([]);

export const eventStats = derived(attendees, ($attendees): EventStats => {
	const attendeeCount = $attendees.filter((a) => a.role === 'Attendee').length;
	const speakerCount = $attendees.filter((a) => a.role === 'Speaker').length;
	const organizerCount = $attendees.filter((a) => a.role === 'Organizer').length;

	return {
		totalAttendees: $attendees.length,
		checkedIn: $attendees.filter((a) => a.isCheckedIn).length,
		kitsDistributed: $attendees.filter((a) => a.hasCollectedKit).length,
		lunchDistributed: $attendees.filter((a) => a.hasCollectedLunch).length,
		attendeeCount,
		speakerCount,
		organizerCount
	};
});

// Helper: Get attendee_id from uniqueId
async function getAttendeeIdByUniqueId(uniqueId: string): Promise<number | null> {
	const res = await fetch(`http://localhost:8000/attendees/`);
	if (!res.ok) return null;
	const data = await res.json();
	const attendee = data.find((a: any) => a.unique_id === uniqueId);
	if (!attendee) {
		console.error(`Attendee not found with uniqueId: ${uniqueId}`);
		console.log(
			'Available attendees:',
			data.map((a: any) => ({ id: a.id, uniqueId: a.unique_id }))
		);
		return null;
	}
	return attendee.id;
}

// Helper: Ensure per-day event exists
async function ensureAttendeeEvent(attendee_id: number, event_date: string) {
	const res = await fetch(
		`http://localhost:8000/attendee_events?event_date=${event_date}&attendee_id=${attendee_id}`
	);
	if (res.ok) {
		const data = await res.json();
		if (data && data.length > 0) return true;
	}
	// Create if not exists
	await fetch(`http://localhost:8000/attendee_events/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ attendee_id, event_date })
	});
	return true;
}

// Per-day status update
async function updateAttendeeEventStatus(
	uniqueId: string,
	eventDate: string,
	type: 'checkin' | 'kit' | 'lunch'
) {
	console.log(`Updating status for uniqueId: ${uniqueId}, date: ${eventDate}, type: ${type}`);
	const attendee_id = await getAttendeeIdByUniqueId(uniqueId);
	if (!attendee_id) {
		console.error(`No attendee found with uniqueId: ${uniqueId}`);
		throw new Error('Attendee not found');
	}
	console.log(`Found attendee with id: ${attendee_id}`);
	await ensureAttendeeEvent(attendee_id, eventDate);
	let endpoint = '';
	switch (type) {
		case 'checkin':
			endpoint = `/attendee_events/${attendee_id}/${eventDate}/checkin`;
			break;
		case 'kit':
			endpoint = `/attendee_events/${attendee_id}/${eventDate}/kit`;
			break;
		case 'lunch':
			endpoint = `/attendee_events/${attendee_id}/${eventDate}/lunch`;
			break;
	}
	const res = await fetch(`http://localhost:8000${endpoint}`, { method: 'PUT' });
	if (!res.ok) {
		const err = await res.json();
		throw new Error(err.detail || 'Failed to update attendee event');
	}
	return true;
}

export async function checkInAttendee(uniqueId: string, eventDate: string) {
	try {
		await updateAttendeeEventStatus(uniqueId, eventDate, 'checkin');
		return { success: true, message: 'Checked in successfully' };
	} catch (e: any) {
		return { success: false, message: e.message };
	}
}

export async function collectKit(uniqueId: string, eventDate: string) {
	try {
		await updateAttendeeEventStatus(uniqueId, eventDate, 'kit');
		return { success: true, message: 'Kit collected' };
	} catch (e: any) {
		return { success: false, message: e.message };
	}
}

export async function collectLunch(uniqueId: string, eventDate: string) {
	try {
		await updateAttendeeEventStatus(uniqueId, eventDate, 'lunch');
		return { success: true, message: 'Lunch collected' };
	} catch (e: any) {
		return { success: false, message: e.message };
	}
}

export async function fetchAttendees(eventDate?: string) {
	// First get all attendees
	const attendeesRes = await fetch('http://localhost:8000/attendees/');
	if (!attendeesRes.ok) return;

	const attendeesData = await attendeesRes.json();
	console.log('Fetched attendees data:', attendeesData);

	if (eventDate) {
		// If eventDate is specified, fetch specific event data for that date
		const eventRes = await fetch(`http://localhost:8000/attendee_events?event_date=${eventDate}`);
		if (eventRes.ok) {
			const eventData = await eventRes.json();
			console.log('Fetched event data for date:', eventDate, eventData);

			// Create a map of attendee events by attendee_id
			const eventMap = new Map();
			eventData.forEach((event: any) => {
				eventMap.set(event.attendee_id, event);
			});

			// Update attendees with event-specific data
			const updatedAttendees = attendeesData.map((a: any) => {
				const event = eventMap.get(a.id);
				return {
					id: a.id, // Include the ID field
					name: a.name,
					email: a.email,
					phone: a.phone,
					role: a.role,
					uniqueId: a.unique_id,
					qrCode: a.qr_code,
					// Use event data if available, otherwise use default values
					isCheckedIn: event ? event.is_checked_in : false,
					hasCollectedKit: event ? event.has_collected_kit : false,
					hasCollectedLunch: event ? event.has_collected_lunch : false,
					registrationTime: event ? event.registration_time : null,
					kitCollectionTime: event ? event.kit_collection_time : null,
					lunchCollectionTime: event ? event.lunch_collection_time : null
				};
			});

			attendees.set(updatedAttendees);
		}
	} else {
		// If no eventDate, just return the basic attendee data
		attendees.set(
			attendeesData.map((a: any) => ({
				id: a.id, // Include the ID field
				name: a.name,
				email: a.email,
				phone: a.phone,
				role: a.role,
				uniqueId: a.unique_id,
				qrCode: a.qr_code,
				isCheckedIn: false,
				hasCollectedKit: false,
				hasCollectedLunch: false
			}))
		);
	}
}
