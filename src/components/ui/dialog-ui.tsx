import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogUIContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogUIContext = React.createContext<DialogUIContextValue | null>(null)

function useDialogUI() {
  const context = React.useContext(DialogUIContext)
  if (!context) {
    throw new Error("useDialogUI must be used within a DialogUI")
  }
  return context
}

interface DialogUIProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function DialogUI({ open: controlledOpen, onOpenChange, children }: DialogUIProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DialogUIContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogUIContext.Provider>
  )
}

interface DialogUITriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

function DialogUITrigger({ children, asChild }: DialogUITriggerProps) {
  const { setOpen } = useDialogUI()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(true),
    })
  }

  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  )
}

interface DialogUIContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

function DialogUIContent({
  children,
  className,
  ...props
}: DialogUIContentProps) {
  const { open, setOpen } = useDialogUI()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
        <div
          className={cn(
            "w-full max-w-lg bg-background p-6 shadow-lg rounded-lg border",
            className
          )}
          {...props}
        >
          {children}
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DialogUIHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogUIFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className
      )}
      {...props}
    />
  )
}

function DialogUITitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogUIDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  DialogUI,
  DialogUITrigger,
  DialogUIContent,
  DialogUIHeader,
  DialogUIFooter,
  DialogUITitle,
  DialogUIDescription,
}
