import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "amber";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold transition-all duration-150 active:scale-98 disabled:opacity-50 disabled:pointer-events-none select-none rounded-xl";

    const variantStyles = {
      primary:
        "bg-cafe-900 text-white hover:bg-cafe-800 shadow-sm border border-cafe-950/20",
      secondary:
        "bg-cafe-100 text-cafe-950 hover:bg-cafe-200 border border-cafe-200",
      amber:
        "bg-amber-400 text-cafe-950 hover:bg-amber-300 shadow-sm border border-amber-500/30",
      outline:
        "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 shadow-2xs",
      ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
      danger:
        "bg-red-600 text-white hover:bg-red-700 shadow-xs border border-red-700/30",
    };

    const sizeStyles = {
      xs: "px-2.5 py-1 text-[11px] gap-1",
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2 text-xs sm:text-sm gap-2 min-h-[40px]",
      lg: "px-5 py-2.5 text-sm sm:text-base gap-2.5 min-h-[48px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent shrink-0" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

