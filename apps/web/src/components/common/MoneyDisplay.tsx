import React from "react";

interface MoneyDisplayProps {
  amount: string | number | null | undefined;
  currencyCode?: string;
  className?: string;
  negative?: boolean;
}

/**
 * Pure string-based money formatter that avoids JavaScript Number / IEEE-754 precision loss.
 * Strictly presentation-only: performs no rounding, no arithmetic, and no authoritative calculations.
 */
function formatFinancialString(value: string): { formatted: string; isNegative: boolean } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { formatted: "", isNegative: false };
  }

  const isNeg = trimmed.startsWith("-");
  const clean = isNeg ? trimmed.slice(1).trim() : (trimmed.startsWith("+") ? trimmed.slice(1).trim() : trimmed);

  // Match integer part and optional fractional part
  const match = clean.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    // Fallback: render raw string as-is without crashing or modifying
    return { formatted: trimmed, isNegative: isNeg };
  }

  const [, intPart, fracPart] = match;
  // Format integer part with thousands grouping using pure string manipulation
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formattedAbs = fracPart !== undefined ? `${formattedInt}.${fracPart}` : formattedInt;

  return {
    formatted: isNeg ? `-${formattedAbs}` : formattedAbs,
    isNegative: isNeg,
  };
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  currencyCode = "SYP",
  className = "",
  negative = false,
}) => {
  if (amount === null || amount === undefined || amount === "") {
    return <span className={`ho-money ho-money-empty ${className}`}>—</span>;
  }

  const rawValue = typeof amount === "number" ? amount.toString() : String(amount);
  const { formatted, isNegative } = formatFinancialString(rawValue);
  const showAsNegative = negative || isNegative;

  return (
    <span
      className={`ho-money ${showAsNegative ? "ho-money-negative" : ""} ${className}`}
      dir="ltr"
    >
      <span className="ho-money-value">{formatted}</span>{" "}
      <span className="ho-money-currency">{currencyCode}</span>
    </span>
  );
};
