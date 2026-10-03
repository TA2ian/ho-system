import React from "react";

export type StatusVariant =
  | "draft"
  | "confirmed"
  | "issued"
  | "voided"
  | "cancelled"
  | "reversed"
  | "active"
  | "recorded"
  | "pending"
  | "placeholder";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

const statusMap: Record<string, { label: string; variant: StatusVariant }> = {
  draft: { label: "مسودة", variant: "draft" },
  confirmed: { label: "مؤكد", variant: "confirmed" },
  issued: { label: "مرحل / صادر", variant: "issued" },
  voided: { label: "ملغي (Voided)", variant: "voided" },
  cancelled: { label: "ملغي", variant: "cancelled" },
  reversed: { label: "مسترجع", variant: "reversed" },
  active: { label: "نشط", variant: "active" },
  recorded: { label: "مسجل", variant: "recorded" },
  pending: { label: "قيد الانتظار", variant: "pending" },
  placeholder: { label: "قيد التأسيس", variant: "placeholder" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  label,
  className = "",
}) => {
  const mapped = statusMap[status.toLowerCase()];
  const displayLabel = label || mapped?.label || status;
  const effectiveVariant = variant || mapped?.variant || "placeholder";

  return (
    <span
      className={`ho-badge ho-badge-${effectiveVariant} ${className}`}
      role="status"
    >
      <span className="ho-badge-dot" aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
};
