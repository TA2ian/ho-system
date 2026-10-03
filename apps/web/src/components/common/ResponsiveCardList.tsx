import React from "react";

interface ResponsiveCardListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  className?: string;
}

export function ResponsiveCardList<T>({
  items,
  keyExtractor,
  renderCard,
  className = "",
}: ResponsiveCardListProps<T>) {
  if (items.length === 0) {
    return <div className="ho-card-list-empty">لا توجد عناصر لعرضها.</div>;
  }

  return (
    <div className={`ho-card-list ${className}`}>
      {items.map((item) => (
        <div key={keyExtractor(item)} className="ho-card-list-item">
          {renderCard(item)}
        </div>
      ))}
    </div>
  );
}
