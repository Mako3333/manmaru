import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const spinnerVariants = cva(
    "inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]",
    {
        variants: {
            size: {
                default: "h-6 w-6",
                sm: "h-4 w-4",
                lg: "h-8 w-8",
                xl: "h-12 w-12",
            },
            variant: {
                default: "text-primary",
                white: "text-white",
                gray: "text-gray-400",
            },
        },
        defaultVariants: {
            size: "default",
            variant: "default",
        },
    }
)

export interface SpinnerProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> { }

export function Spinner({ className, size, variant, ...props }: SpinnerProps) {
    return (
        <div
            className={cn(spinnerVariants({ size, variant, className }))}
            role="status"
            aria-label="読み込み中"
            {...props}
        >
            <span className="sr-only">読み込み中...</span>
        </div>
    )
} 