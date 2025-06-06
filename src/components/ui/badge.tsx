
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        upload: 
          "border-transparent bg-[hsl(var(--badge-upload-background))] text-[hsl(var(--badge-upload-foreground))] hover:bg-[hsl(var(--badge-upload-background))]/80",
        rilis: 
          "border-transparent bg-[hsl(var(--badge-rilis-background))] text-[hsl(var(--badge-rilis-foreground))] hover:bg-[hsl(var(--badge-rilis-background))]/80",
        pending: 
          "border-transparent bg-[hsl(var(--badge-pending-background))] text-[hsl(var(--badge-pending-foreground))] hover:bg-[hsl(var(--badge-pending-background))]/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
