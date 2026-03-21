import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "purple"
    | "shopify"
    | "studio";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  dot,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-gray-50 text-gray-600 border-gray-200/60",
    primary: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    warning: "bg-amber-50 text-amber-700 border-amber-200/60",
    danger: "bg-red-50 text-red-700 border-red-200/60",
    purple: "bg-purple-50 text-purple-700 border-purple-200/60",
    shopify: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    studio: "bg-purple-50 text-purple-700 border-purple-200/60",
  };

  const dotColors = {
    default: "bg-gray-400",
    primary: "bg-indigo-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    purple: "bg-purple-500",
    shopify: "bg-emerald-500",
    studio: "bg-purple-500",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium border",
        "transition-colors duration-200",
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
