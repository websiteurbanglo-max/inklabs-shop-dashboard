import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const initial = fallback?.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center",
        sizeClass,
        className
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || "Avatar"}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken image
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="w-full h-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-700">
          {initial}
        </div>
      )}
    </div>
  );
}
