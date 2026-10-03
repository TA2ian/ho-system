import React from "react";

interface MoneyDisplayProps {
  amount: string | number | null | undefined;
  currencyCode?: string;
  className?: string;
  negative?: boolean;
}

/**
 * MoneyDisplay is strictly a presentation-only component.
 * It formats numbers returned by the API without performing authoritative calculations client-side.
 */
export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  currencyCode = "SYP",
  className = "",
  negative = false,
}) => {
  if (amount === null || amount === undefined || amount === "") {
    return <span className={`ho-money ho-money-empty ${className}`}>—</span>;
  }

  const rawValue = typeof amount === "number" ? amount.toString() : amount;
  
  // Format with standard grouping if parsable, else display raw string safely
  let formattedNumber = rawValue;
  const parsed = Number(rawValue);
  if (!Number.isNaN(parsed)) {
    formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed);
  }

  return (
    <span
      className={`ho-money ${negative ? "ho-money-negative" : ""} ${className}`}
      dir="ltr"
    >
      <span className="ho-money-value">{formattedNumber}</span>{" "}
      <span className="ho-money-currency">{currencyCode}</span>
    </span>
  );
};
