
import React from 'react';

interface GradeInputProps {
  label: string;
  value: number;
  onValueChange: (newValue: number) => void;
  min?: number;
  max?: number;
}

const NumberInput: React.FC<GradeInputProps> = ({ label, value, onValueChange, min = 0, max = 20 }) => {
  const handleIncrement = () => {
    if (value < max) {
      onValueChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onValueChange(value - 1);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let num = parseInt(e.target.value, 10);
    if (isNaN(num)) {
      num = min;
    }
    if (num < min) num = min;
    if (num > max) num = max;
    onValueChange(num);
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex items-center justify-between bg-slate-800 rounded-full border border-slate-600 h-11">
        <button
          onClick={handleDecrement}
          disabled={value <= min}
          className="px-4 text-2xl font-light text-slate-300 hover:text-white disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrement"
        >
          &lt;
        </button>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          className="w-12 text-center text-2xl font-bold bg-transparent text-cyan-400 focus:outline-none focus:ring-0 border-0 p-0"
        />
        <button
          onClick={handleIncrement}
          disabled={value >= max}
          className="px-4 text-2xl font-light text-slate-300 hover:text-white disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          aria-label="Increment"
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

export default NumberInput;
