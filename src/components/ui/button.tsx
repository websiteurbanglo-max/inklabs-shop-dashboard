import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = [
      "inline-flex items-center justify-center font-medium rounded-xl",
      "transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "active:scale-[0.97] press",
      "relative overflow-hidden",
    ].join(" ");

    const variants = {
      primary: [
        "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white",
        "hover:from-indigo-600 hover:to-indigo-700",
        "shadow-sm hover:shadow-md hover:shadow-indigo-200/50",
        "focus-visible:ring-indigo-500",
        "border border-indigo-600/20",
      ].join(" "),
      secondary: [
        "bg-gray-50 text-gray-900 border border-gray-200",
        "hover:bg-gray-100 hover:border-gray-300",
        "focus-visible:ring-gray-400",
      ].join(" "),
      ghost: [
        "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        "focus-visible:ring-gray-400",
      ].join(" "),
      danger: [
        "bg-gradient-to-b from-red-500 to-red-600 text-white",
        "hover:from-red-600 hover:to-red-700",
        "shadow-sm hover:shadow-md hover:shadow-red-200/50",
        "focus-visible:ring-red-500",
        "border border-red-600/20",
      ].join(" "),
      outline: [
        "border border-gray-200 bg-white text-gray-700",
        "hover:bg-gray-50 hover:border-gray-300",
        "shadow-sm hover:shadow",
        "focus-visible:ring-indigo-500",
      ].join(" "),
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-sm gap-2.5 font-semibold",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-80"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
