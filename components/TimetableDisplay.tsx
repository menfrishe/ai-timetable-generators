import React, { useState } from 'react';
import type { TimetableData, Grade, DayOfWeek, TimeSlot } from '../types';

interface DraggedItem {
    className: string;
    from: {
        room: string;
        day: DayOfWeek;
        slot: TimeSlot;
    }
}

interface TimetableDisplayProps {
  roomName: string;
  timetable: TimetableData;
  onMoveClass: (className: string, from: DraggedItem['from'], to: DraggedItem['from']) => void;
  maxConcurrentClasses: number;
  timeSlots: string[];
  includedDays: DayOfWeek[];
  draggedItem: DraggedItem | null;
  onClassDragStart: (className: string, fromRoom: string, fromDay: DayOfWeek, fromSlot: TimeSlot) => void;
  onDragEnd: () => void;
}

const getGradeFromClassName = (className: string): Grade | null => {
    const match = className.match(/Grade (\d)/);
    if (match && match[1]) {
        return parseInt(match[1], 10) as Grade;
    }
    return null;
};

const getGradeColor = (grade: Grade | null): string => {
    switch (grade) {
        case 1: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300';
        case 2: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300';
        case 3: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300';
        case 4: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300';
        case 5: return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 border-pink-300';
        default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300';
    }
};

interface ClassTagProps {
    className: string;
    room: string;
    day: DayOfWeek;
    slot: TimeSlot;
    onClassDragStart: (className: string, fromRoom: string, fromDay: DayOfWeek, fromSlot: TimeSlot) => void;
}

const ClassTag: React.FC<ClassTagProps> = ({ className, room, day, slot, onClassDragStart }) => {
    const grade = getGradeFromClassName(className);
    const colorClasses = getGradeColor(grade);

    const handleDragStart = (e: React.DragEvent) => {
        onClassDragStart(className, room, day, slot);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            draggable="true"
            onDragStart={handleDragStart}
            className={`px-2.5 py-1 text-sm font-medium rounded-full border ${colorClasses} cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md`}
        >
            {className}
        </div>
    );
};


const TimetableDisplay: React.FC<TimetableDisplayProps> = ({ roomName, timetable, onMoveClass, maxConcurrentClasses, timeSlots, includedDays, draggedItem, onClassDragStart, onDragEnd }) => {
  const [dragOverInfo, setDragOverInfo] = useState<{ day: DayOfWeek; slot: TimeSlot; isValid: boolean } | null>(null);

  const handleDragOver = (e: React.DragEvent, day: DayOfWeek, slot: TimeSlot) => {
    e.preventDefault();
    if (!timetable || !draggedItem) return;

    if (draggedItem.from.room === roomName && draggedItem.from.day === day && draggedItem.from.slot === slot) {
      setDragOverInfo(null);
      return;
    }

    if (dragOverInfo?.day === day && dragOverInfo?.slot === slot) return;

    const destinationSlot = timetable[day]?.[slot];
    if (destinationSlot) {
      const atCapacity = destinationSlot.length >= maxConcurrentClasses;

      const movedGrade = getGradeFromClassName(draggedItem.className);
      const destinationGrades = destinationSlot.map(getGradeFromClassName);
      
      const hasGrade1 = destinationGrades.includes(1);
      const hasGrade2 = destinationGrades.includes(2);
      const hasGrade3 = destinationGrades.includes(3);
      const hasGrade4 = destinationGrades.includes(4);

      let coSchedulingConflict = false;
      if (movedGrade === 1 && hasGrade2) coSchedulingConflict = true;
      if (movedGrade === 2 && hasGrade1) coSchedulingConflict = true;
      if (movedGrade === 3 && hasGrade4) coSchedulingConflict = true;
      if (movedGrade === 4 && hasGrade3) coSchedulingConflict = true;

      const isValidDrop = !atCapacity && !coSchedulingConflict;
      setDragOverInfo({ day, slot, isValid: isValidDrop });
      e.dataTransfer.dropEffect = isValidDrop ? 'move' : 'none';
    }
  };

  const handleDrop = (e: React.DragEvent, toDay: DayOfWeek, toSlot: TimeSlot) => {
    e.preventDefault();
    if (draggedItem && dragOverInfo?.isValid) {
      onMoveClass(
        draggedItem.className,
        draggedItem.from,
        { room: roomName, day: toDay, slot: toSlot }
      );
    }
    setDragOverInfo(null);
  };
  
  const handleDragLeave = () => {
    setDragOverInfo(null);
  }

  return (
    <div className="flow-root" onDragEnd={onDragEnd}>
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 sm:pl-6 w-1/6">
                    Time
                  </th>
                  {includedDays.map((day) => (
                    <th key={day} scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-900 dark:text-slate-100 border-l border-slate-300 dark:border-slate-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800/50">
                {timeSlots.map((slot) => (
                  <tr key={slot}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 dark:text-slate-100 sm:pl-6">
                      {slot}
                    </td>
                    {includedDays.map((day) => {
                       const isTarget = dragOverInfo?.day === day && dragOverInfo?.slot === slot;
                       const targetBgClass = isTarget
                           ? dragOverInfo.isValid
                               ? 'bg-green-100 dark:bg-green-900/50'
                               : 'bg-red-100 dark:bg-red-900/50'
                           : '';
                      
                      return (
                        <td 
                          key={`${day}-${slot}`} 
                          onDragOver={(e) => handleDragOver(e, day, slot)}
                          onDrop={(e) => handleDrop(e, day, slot)}
                          onDragLeave={handleDragLeave}
                          className={`whitespace-nowrap px-3 py-4 text-sm align-top transition-colors duration-200 ${targetBgClass} border-l border-slate-200 dark:border-slate-700`}
                        >
                          <div className="flex flex-col items-center gap-2 min-h-[36px]">
                             {timetable?.[day]?.[slot]?.length > 0 ? (
                                  timetable[day][slot].map((className) => (
                                      <ClassTag 
                                        key={className} 
                                        className={className} 
                                        room={roomName}
                                        day={day} 
                                        slot={slot} 
                                        onClassDragStart={onClassDragStart}
                                      />
                                  ))
                             ) : (
                              <span className="text-slate-400 dark:text-slate-500">-</span>
                             )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableDisplay;
