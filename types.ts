export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type TimeSlot = string;

export type Grade = 1 | 2 | 3 | 4 | 5;

export type GradeCounts = Record<Grade, number>;

export type TimetableSlot = string[];

export type TimetableDay = Record<TimeSlot, TimetableSlot>;

export type TimetableData = Record<DayOfWeek, TimetableDay>;

export type MultiRoomTimetable = Record<string, TimetableData>;
