import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({
  title,
  subtitle,
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border p-6 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      )}
      {subtitle && (
        <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
