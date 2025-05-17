export interface Attendee {
	id?: number;
	name: string;
	email: string;
	phone: string;
	role: string;
	uniqueId: string;
	qrCode?: string;
	isCheckedIn: boolean;
	hasCollectedKit: boolean;
	hasCollectedLunch: boolean;
	registrationTime?: Date | string | null;
	kitCollectionTime?: Date | string | null;
	lunchCollectionTime?: Date | string | null;
}

export interface EventStats {
	totalAttendees: number;
	checkedIn: number;
	kitsDistributed: number;
	lunchDistributed: number;
	attendeeCount: number;
	speakerCount: number;
	organizerCount: number;
}
