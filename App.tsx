import React, { useState, useCallback, useMemo } from 'react';
import type { GradeCounts, MultiRoomTimetable, Grade, DayOfWeek, TimeSlot } from './types';
import { GRADES, DAYS_OF_WEEK } from './constants';
import { generateTimetable } from './services/geminiService';
import NumberInput from './components/GradeInput';
import TimetableDisplay from './components/TimetableDisplay';

interface DraggedItem {
    className: string;
    from: {
        room: string;
        day: DayOfWeek;
        slot: TimeSlot;
    }
}

const getGradeFromClassName = (className: string): Grade | null => {
    const match = className.match(/Grade (\d)/);
    if (match && match[1]) {
        return parseInt(match[1], 10) as Grade;
    }
    return null;
};

const App: React.FC = () => {
  const [gradeCounts, setGradeCounts] = useState<GradeCounts>(() => {
    const initialCounts: Partial<GradeCounts> = {};
    GRADES.forEach(g => { initialCounts[g] = 0; });
    return initialCounts as GradeCounts;
  });
  const [maxConcurrentClasses, setMaxConcurrentClasses] = useState<number>(3);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);
  const [includedDays, setIncludedDays] = useState<DayOfWeek[]>(() => [...DAYS_OF_WEEK]);
  const [timetable, setTimetable] = useState<MultiRoomTimetable | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);

  const handleGradeCountChange = useCallback((grade: Grade, count: number) => {
    setGradeCounts(prev => ({ ...prev, [grade]: count }));
  }, []);

  const handleDayToggle = useCallback((day: DayOfWeek) => {
    setIncludedDays(prev => {
        const newDays = prev.includes(day)
            ? prev.filter(d => d !== day)
            : [...prev, day];
        
        newDays.sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));
        
        return newDays;
    });
  }, []);

  const timeSlots = useMemo(() => {
    return Array.from({ length: sessionsPerDay }, (_, i) => `Slot ${i + 1}`);
  }, [sessionsPerDay]);

  const totalClasses = useMemo(() => {
    return Object.values(gradeCounts).reduce((sum: number, count: number) => sum + count, 0);
  }, [gradeCounts]);
  
  const maxPossibleClasses = useMemo(() => maxConcurrentClasses * includedDays.length * sessionsPerDay * numberOfRooms, [maxConcurrentClasses, sessionsPerDay, includedDays, numberOfRooms]);

  const canGenerate = useMemo(() => {
    return totalClasses > 0 && includedDays.length > 0 && totalClasses <= maxPossibleClasses && !isLoading;
  }, [totalClasses, maxPossibleClasses, isLoading, includedDays]);

  const handleGenerateClick = async () => {
    if (!canGenerate) return;

    setIsLoading(true);
    setError(null);
    setTimetable(null);

    try {
      const result = await generateTimetable(gradeCounts, maxConcurrentClasses, sessionsPerDay, includedDays, numberOfRooms);
      setTimetable(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveClass = useCallback((
    className: string,
    from: DraggedItem['from'],
    to: DraggedItem['from']
  ) => {
    if (from.room === to.room && from.day === to.day && from.slot === to.slot) return;

    setTimetable(currentTimetable => {
        if (!currentTimetable) return null;

        const toSlotClasses = currentTimetable[to.room]?.[to.day]?.[to.slot];
        if(!toSlotClasses) {
            console.error("Destination slot not found", to);
            return currentTimetable;
        }
        
        // Prevent adding to self if it's the same slot (in case of UI lag)
        const isAlreadyInSlot = toSlotClasses.includes(className);
        if (isAlreadyInSlot) return currentTimetable;

        if (toSlotClasses.length >= maxConcurrentClasses) {
            setError(`Cannot move "${className}". The "${to.slot}" slot in ${to.room} on ${to.day} is full (max ${maxConcurrentClasses} classes).`);
            return currentTimetable;
        }
        
        const movedGrade = getGradeFromClassName(className);
        const destinationGrades = toSlotClasses.map(getGradeFromClassName);

        if ((movedGrade === 1 && destinationGrades.includes(2)) || (movedGrade === 2 && destinationGrades.includes(1))) {
            setError("Cannot move: Grade 1 and Grade 2 classes cannot be in the same slot.");
            return currentTimetable;
        }
        if ((movedGrade === 3 && destinationGrades.includes(4)) || (movedGrade === 4 && destinationGrades.includes(3))) {
            setError("Cannot move: Grade 3 and Grade 4 classes cannot be in the same slot.");
            return currentTimetable;
        }

        const newTimetable = JSON.parse(JSON.stringify(currentTimetable));

        const fromSlotClasses = newTimetable[from.room]?.[from.day]?.[from.slot];
        if(!fromSlotClasses){
            console.error("Source slot not found", from);
            return currentTimetable;
        }
        const classIndex = fromSlotClasses.findIndex((c: string) => c === className);

        if (classIndex > -1) {
            fromSlotClasses.splice(classIndex, 1);
        } else {
            console.error("Could not find class to move in source slot.");
            return currentTimetable;
        }

        newTimetable[to.room][to.day][to.slot].push(className);
        newTimetable[to.room][to.day][to.slot].sort();

        setError(null);
        return newTimetable;
    });
  }, [maxConcurrentClasses]);

  const handleClassDragStart = useCallback((className: string, fromRoom: string, fromDay: DayOfWeek, fromSlot: TimeSlot) => {
    setError(null);
    setDraggedItem({
        className,
        from: { room: fromRoom, day: fromDay, slot: fromSlot }
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);
  
  const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white">
            AI Timetable Generator
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Intelligently schedule your primary school classes with the power of AI.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-8 bg-white dark:bg-slate-800/50 shadow-lg rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
                Configuration
              </h2>
              
              <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">1. Classes per Grade</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-x-6 gap-y-8">
                      {GRADES.map((grade) => (
                        <NumberInput
                          key={grade}
                          label={`Grade ${grade}`}
                          value={gradeCounts[grade]}
                          onValueChange={(count) => handleGradeCountChange(grade, count)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">2. Schedule Settings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 auto-rows-fr">
                      <NumberInput
                        label="Max classes at once"
                        value={maxConcurrentClasses}
                        onValueChange={setMaxConcurrentClasses}
                        min={1}
                      />
                      <NumberInput
                        label="Time slots per day"
                        value={sessionsPerDay}
                        onValueChange={setSessionsPerDay}
                        min={1}
                        max={5}
                      />
                      <NumberInput
                        label="Number of Rooms"
                        value={numberOfRooms}
                        onValueChange={setNumberOfRooms}
                        min={1}
                        max={10}
                      />
                    </div>
                  </div>

                  <div>
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">3. Active Days</h3>
                      <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map(day => {
                              const isIncluded = includedDays.includes(day);
                              return (
                                  <button
                                      key={day}
                                      onClick={() => handleDayToggle(day)}
                                      type="button"
                                      className={`px-3 py-1.5 text-sm font-semibold rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 ${
                                          isIncluded
                                              ? 'bg-indigo-600 text-white border-transparent'
                                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                                      }`}
                                  >
                                      {day}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">4. Generate</h3>
                    <div className="flex flex-col gap-4">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                          <p><span className="font-semibold">Total Classes:</span> {totalClasses}</p>
                          <p><span className="font-semibold">Max Capacity:</span> {maxPossibleClasses}</p>
                          {totalClasses > maxPossibleClasses && (
                            <p className="text-red-500 dark:text-red-400 font-medium mt-1">Warning: Total classes exceed capacity.</p>
                          )}
                      </div>
                      <button
                        onClick={handleGenerateClick}
                        disabled={!canGenerate}
                        className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-150"
                      >
                        {isLoading && <LoadingSpinner />}
                        {isLoading ? 'Generating...' : 'Generate Timetable'}
                      </button>
                    </div>
                  </div>
              </div>

            </div>
          </div>
          
          <div className="lg:col-span-8 xl:col-span-9 space-y-12">
            {error && (
              <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            
            {!timetable && !isLoading && (
               <div className="flex items-center justify-center p-12 min-h-[60vh] bg-white dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400">Your generated timetable will appear here.</p>
              </div>
            )}

            {timetable && Object.entries(timetable).map(([roomName, roomTimetable]) => (
                <div key={roomName}>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{roomName}</h2>
                    <TimetableDisplay
                        roomName={roomName}
                        timetable={roomTimetable}
                        onMoveClass={handleMoveClass}
                        maxConcurrentClasses={maxConcurrentClasses}
                        timeSlots={timeSlots}
                        includedDays={includedDays}
                        draggedItem={draggedItem}
                        onClassDragStart={handleClassDragStart}
                        onDragEnd={handleDragEnd}
                    />
                </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
