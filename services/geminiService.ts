import { GoogleGenAI, Type } from "@google/genai";
import type { GradeCounts, MultiRoomTimetable, DayOfWeek } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const generateSingleRoomResponseSchema = (sessionsPerDay: number, includedDays: DayOfWeek[]) => {
    const timeSlotProperties: Record<string, any> = {};
    const requiredSlots: string[] = [];

    for (let i = 1; i <= sessionsPerDay; i++) {
        const slotName = `Slot ${i}`;
        timeSlotProperties[slotName] = { type: Type.ARRAY, items: { type: Type.STRING } };
        requiredSlots.push(slotName);
    }
    
    const daySchema = {
        type: Type.OBJECT,
        properties: timeSlotProperties,
        required: requiredSlots
    };

    const timetableProperties: Record<string, any> = {};
    includedDays.forEach(day => {
        timetableProperties[day] = daySchema;
    });

    return {
        type: Type.OBJECT,
        properties: timetableProperties,
        required: includedDays
    };
};


const generateResponseSchema = (sessionsPerDay: number, includedDays: DayOfWeek[], numberOfRooms: number) => {
    const singleRoomSchema = generateSingleRoomResponseSchema(sessionsPerDay, includedDays);
    const roomProperties: Record<string, any> = {};
    const requiredRooms: string[] = [];
    
    for (let i = 1; i <= numberOfRooms; i++) {
        const roomName = `Room ${i}`;
        roomProperties[roomName] = singleRoomSchema;
        requiredRooms.push(roomName);
    }

    return {
        type: Type.OBJECT,
        properties: roomProperties,
        required: requiredRooms,
    };
};


const generatePrompt = (gradeCounts: GradeCounts, maxConcurrentClasses: number, sessionsPerDay: number, includedDays: DayOfWeek[], numberOfRooms: number): string => {
  const classList = Object.entries(gradeCounts)
    .map(([grade, count]) => `- Grade ${grade}: ${count} classes`)
    .join('\n');

  const timeSlotList = Array.from({ length: sessionsPerDay }, (_, i) => `Slot ${i + 1}`).join(', ');
  const dayList = includedDays.join(', ');

  return `
    You are an expert school timetable scheduler. Your task is to create a weekly timetable for a primary school with grades 1 through 5, distributing classes across ${numberOfRooms} available rooms.

    Here are the constraints:
    1.  **Classes to Schedule:**
        ${classList}
        (When you create the schedule, name the classes like "Grade 1 - A", "Grade 1 - B", "Grade 2 - A", etc.)

    2.  **Schedule Structure:**
        - There are ${numberOfRooms} rooms available, named "Room 1", "Room 2", etc.
        - The week includes only the following days: ${dayList}.
        - There are ${sessionsPerDay} available time slots each day: ${timeSlotList}.

    3.  **Scheduling Rules:**
        - Every single class implied by the counts above must be scheduled exactly once across all rooms.
        - In any single time slot (e.g., Room 1, Monday Slot 1), you cannot schedule more than ${maxConcurrentClasses} classes in total.
        - **Crucially, Grade 1 and Grade 2 classes must NEVER be scheduled in the same time slot together in the same room.**
        - **Similarly, Grade 3 and Grade 4 classes must NEVER be scheduled in the same time slot together in the same room.**
        - **VERY IMPORTANT ROOM ALLOCATION RULE: You must fill up the schedule for "Room 1" as much as possible before assigning any classes to "Room 2". Then, fill "Room 2" before "Room 3", and so on. Follow this sequential filling order strictly.**
        - Distribute the classes as evenly as possible throughout the week to balance the school's activity, while respecting all other rules.

    Please provide the generated timetable in the specified JSON format. The output should be a JSON object where the keys are the room names (e.g., "Room 1", "Room 2").
  `;
};

export const generateTimetable = async (gradeCounts: GradeCounts, maxConcurrentClasses: number, sessionsPerDay: number, includedDays: DayOfWeek[], numberOfRooms: number): Promise<MultiRoomTimetable> => {
  const prompt = generatePrompt(gradeCounts, maxConcurrentClasses, sessionsPerDay, includedDays, numberOfRooms);
  const schema = generateResponseSchema(sessionsPerDay, includedDays, numberOfRooms);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.5,
      },
    });

    const text = response.text.trim();
    const parsedData = JSON.parse(text);

    // Basic validation to ensure we have the expected multi-room structure
    if (typeof parsedData === 'object' && parsedData !== null && Object.keys(parsedData).length === numberOfRooms) {
        return parsedData as MultiRoomTimetable;
    } else {
        throw new Error("Invalid timetable format received from API. Expected a structure with rooms.");
    }
  } catch (error) {
    console.error("Error generating timetable:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate timetable: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the timetable.");
  }
};
