export async function getAttendeeByUUID(uuid) {
	const res = await fetch(`http://localhost:8000/attendees/`);
	if (!res.ok) throw new Error('Failed to fetch attendees');
	const attendees = await res.json();
	return attendees.find((a) => a.unique_id === uuid);
}

export async function generateQRCode(data) {
	if (window.QRCode) {
		return await window.QRCode.toDataURL(data);
	}
	return data;
}
