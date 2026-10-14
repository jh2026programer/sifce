import { useRef } from 'react';

// Entrada de código de 6 dígitos: una casilla por dígito, avanza sola al
// escribir, retrocede con Backspace en una casilla vacía, y soporta pegar
// el código completo de una vez (ej. copiado de un correo).
export default function OtpInput({ value, onChange, disabled }) {
  const inputsRef = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const setDigit = (index, digit) => {
    const next = [...digits];
    next[index] = digit;
    onChange(next.join('').replace(/\s/g, ''));
  };

  const handleChange = (index) => (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(index, '');
      return;
    }
    // Si el usuario pegó varios dígitos en una sola casilla, repartirlos.
    if (raw.length > 1) {
      const next = [...digits];
      raw.split('').forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      onChange(next.join(''));
      const lastFilled = Math.min(index + raw.length, 6) - 1;
      inputsRef.current[lastFilled]?.focus();
      return;
    }
    setDigit(index, raw);
    if (index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="otp-input-group">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          className="otp-digit"
          inputMode="numeric"
          maxLength={6}
          value={digit}
          disabled={disabled}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
