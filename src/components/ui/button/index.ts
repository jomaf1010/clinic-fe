import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "rounded-full border border-white/45 bg-[linear-gradient(135deg,rgb(37,99,235),rgb(20,184,166))] text-white shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)] active:translate-y-0 dark:border-white/10 dark:shadow-[0_14px_34px_rgba(0,0,0,0.28)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "surface-muted rounded-full border border-white/50 text-foreground shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-md hover:-translate-y-0.5 hover:bg-white/60 hover:text-accent-foreground hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)] active:translate-y-0 dark:border-white/10 dark:hover:bg-white/10",
        secondary:
          "rounded-full border border-white/50 bg-white/60 text-primary shadow-[0_10px_26px_rgba(37,99,235,0.1)] backdrop-blur-md hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_14px_32px_rgba(37,99,235,0.14)] active:translate-y-0 dark:border-white/10 dark:bg-white/10 dark:text-blue-300 dark:hover:bg-white/15",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        "default": "h-9 px-4 py-2 has-[>svg]:px-3",
        "sm": "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        "lg": "h-10 rounded-md px-6 has-[>svg]:px-4",
        "icon": "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
