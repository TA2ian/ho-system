import React from "react";

interface PaginationProps {
  offset: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (newOffset: number) => void;
  disabled?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  offset,
  limit,
  hasMore,
  onPageChange,
  disabled = false,
  className = "",
}) => {
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <nav className={`ho-pagination ${className}`} aria-label="تنقل الصفحات">
      <button
        type="button"
        className="ho-btn ho-btn-secondary ho-btn-sm"
        disabled={offset === 0 || disabled}
        onClick={() => onPageChange(Math.max(0, offset - limit))}
        aria-label="الانتقال إلى الصفحة السابقة"
      >
        السابق
      </button>

      <span className="ho-pagination-info" aria-current="page">
        الصفحة {currentPage}
      </span>

      <button
        type="button"
        className="ho-btn ho-btn-secondary ho-btn-sm"
        disabled={!hasMore || disabled}
        onClick={() => onPageChange(offset + limit)}
        aria-label="الانتقال إلى الصفحة التالية"
      >
        التالي
      </button>
    </nav>
  );
};
