import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: "green" | "amber" | "blue" | "red" | "gray";
  className?: string;
}

const colorClasses = {
  green: "bg-wellab-100 text-wellab-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-800",
};

export default function Badge({
  children,
  color = "gray",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${colorClasses[color]} ${className}`}
    >
      {children}
    </span>
  );
}
