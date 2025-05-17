import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import type { Attendee } from './types';
import { attendees } from './stores';
import { get } from 'svelte/store';

export async function generateQRCode(data: string): Promise<string> {
	try {
		return await QRCode.toDataURL(data);
	} catch (error) {
		console.error('Error generating QR code:', error);
		return '';
	}
}

export async function parseAttendeeCSV(file: File): Promise<{ success: boolean; message: string }> {
	return new Promise((resolve) => {
		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			complete: async (results) => {
				if (results.errors && results.errors.length > 0) {
					resolve({
						success: false,
						message: `Error parsing CSV: ${results.errors[0].message}`
					});
					return;
				}

				try {
					const newAttendees: Attendee[] = [];
					let backendSuccess = 0;
					let backendFail = 0;

					for (const row of results.data as Record<string, string>[]) {
						const uniqueId = uuidv4();
						const qrCodeData = JSON.stringify({ uniqueId });
						const qrCode = await generateQRCode(qrCodeData);

						const attendee: Attendee = {
							name: row.Name || '',
							email: row.Email || '',
							phone: row.Phone || '',
							role: row.Role || 'Attendee',
							uniqueId,
							qrCode,
							isCheckedIn: false,
							hasCollectedKit: false,
							hasCollectedLunch: false
						};

						try {
							const res = await fetch('http://localhost:8000/attendees/', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									name: attendee.name,
									email: attendee.email,
									phone: attendee.phone,
									role: attendee.role,
									unique_id: attendee.uniqueId,
									qr_code: attendee.qrCode,
									is_checked_in: false,
									has_collected_kit: false,
									has_collected_lunch: false
								})
							});
							if (res.ok) {
								backendSuccess++;
								newAttendees.push(attendee);
							} else {
								backendFail++;
							}
						} catch (err) {
							backendFail++;
						}
					}

					attendees.set(newAttendees);
					localStorage.setItem('eventAttendees', JSON.stringify(newAttendees));

					resolve({
						success: backendFail === 0,
						message: `Imported ${backendSuccess} attendees${
							backendFail ? `, ${backendFail} failed to save to backend` : ''
						}`
					});
				} catch (error) {
					console.error('Error processing attendees:', error);
					resolve({
						success: false,
						message: `Error processing attendees: ${error}`
					});
				}
			},
			error: (error) => {
				resolve({
					success: false,
					message: `Error parsing CSV: ${error.message}`
				});
			}
		});
	});
}

export function loadAttendeesFromStorage(): void {
	const storedData = localStorage.getItem('eventAttendees');
	if (storedData) {
		try {
			const loadedAttendees = JSON.parse(storedData);
			attendees.set(loadedAttendees);
		} catch (error) {
			console.error('Error loading attendees from storage:', error);
		}
	}
}

export function saveAttendeesToStorage(): void {
	const currentAttendees = get(attendees);
	localStorage.setItem('eventAttendees', JSON.stringify(currentAttendees));
}

export function exportAttendeesToCSV(): void {
	const currentAttendees = get(attendees);
	const csv = Papa.unparse(currentAttendees);

	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.setAttribute('href', url);
	link.setAttribute('download', `event-attendees-${new Date().toISOString().split('T')[0]}.csv`);
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
