// src/components/ui/pagination.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"   // <-- WAJIB: import ini!

export function Pagination({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

export function PaginationItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return <li className={cn("", className)} {...props} />
}

type PaginationLinkProps = React.ComponentProps<"a"> & {
  isActive?: boolean
}

export function PaginationLink({
  className,
  isActive,
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" }),
        className
      )}
      {...props}
    />
  )
}

export function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "gap-1 pl-2",
        className
      )}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
        Previous
      </span>
    </a>
  )
}

export function PaginationNext({
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "gap-1 pr-2",
        className
      )}
      {...props}
    >
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
        Next
      </span>
      <ChevronRight className="h-4 w-4" />
    </a>
  )
}

export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center",
        className
      )}
      {...props}
    >
      <span className="sr-only">More pages</span>
      …
    </span>
  )
}
