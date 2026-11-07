import React, { useRef } from 'react';

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

// Accessible 6-digit OTP code entry with auto-focus and clipboard paste matching Figma design
export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled = false }) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const updated = [...value];
    updated[index] = digit;
    onChange(updated);

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = [...value];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || '';
    }
    onChange(updated);

    const targetFocus = Math.min(pasted.length, 5);
    inputsRef.current[targetFocus]?.focus();
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Verification digit ${idx + 1}`}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          className="aspect-square w-full rounded-md border-2 border-zinc-950 bg-white text-center text-xl font-black outline-none transition-shadow focus:bg-yellow-100 focus:shadow-[3px_3px_0_#65d6c4] disabled:opacity-50"
        />
      ))}
    </div>
  );
};
