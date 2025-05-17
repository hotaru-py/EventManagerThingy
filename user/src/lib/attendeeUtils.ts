export async function getAttendeeByUUID(uuid: string, eventDate?: string) {
	if (!uuid) return null;
	if (eventDate) {
		const res = await fetch(
			`http://localhost:8000/attendee_events?event_date=${eventDate}&uuid=${uuid}`
		);
		const data = await res.json();
		return data && data.length > 0 ? data[0] : null;
	} else {
		const res = await fetch(`http://localhost:8000/attendees/${uuid}`);
		if (!res.ok) return null;
		return await res.json();
	}
}

export async function updateAttendeeStatus(
	uuid: string,
	date: string,
	field: 'is_checked_in' | 'has_collected_lunch' | 'has_collected_kit',
	value: boolean
): Promise<boolean> {
	try {
		const url = `http://localhost:8000/attendee_events/update`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				unique_id: uuid,
				event_date: date,
				field: field,
				value: value
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to update status: ${response.statusText}`);
		}

		const result = await response.json();
		return result.success === true;
	} catch (error) {
		console.error('Error updating attendee status:', error);
		return false;
	}
}

export async function generateQRCode(data: string): Promise<string> {
	if ((window as any).QRCode) {
		return await (window as any).QRCode.toDataURL(data);
	}
	return '';
}
