import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * PIN or password field. Opens the numeric keypad (most people use a PIN) but accepts any text,
 * so whoever prefers a password can type one.
 */
export function PinInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        inputMode="numeric"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('h-11 pr-11 text-base tracking-widest', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
        aria-label={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}
