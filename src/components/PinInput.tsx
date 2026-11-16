import { useRef, useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Keyboard = 'numeric' | 'text'

const KEYBOARD_KEY = 'amigo-secreto:teclado'

function savedKeyboard(): Keyboard {
  try {
    return localStorage.getItem(KEYBOARD_KEY) === 'text' ? 'text' : 'numeric'
  } catch {
    return 'numeric'
  }
}

/**
 * PIN or password field. Opens the number pad by default (most people use a PIN); the "ABC" button
 * switches to the full keyboard for passwords. The choice is remembered on this device.
 */
export function PinInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const [keyboard, setKeyboard] = useState<Keyboard>(() => {
    // A value with letters (e.g. typed before) means a password.
    if (typeof props.value === 'string' && /\D/.test(props.value)) return 'text'
    return savedKeyboard()
  })
  const input = useRef<HTMLInputElement>(null)

  function switchKeyboard() {
    const next: Keyboard = keyboard === 'numeric' ? 'text' : 'numeric'
    setKeyboard(next)
    try {
      localStorage.setItem(KEYBOARD_KEY, next)
    } catch {
      // Private mode: just not remembered.
    }
    // Phones only swap the keyboard on focus, so refocus the field.
    const el = input.current
    if (el && document.activeElement === el) {
      el.blur()
      requestAnimationFrame(() => el.focus())
    }
  }

  return (
    <div className="relative">
      <Input
        ref={input}
        type={visible ? 'text' : 'password'}
        inputMode={keyboard}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('h-11 pr-24 text-base tracking-widest', className)}
        {...props}
      />
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          type="button"
          // Keep focus in the field on tap, so the keyboard doesn't close and reopen twice.
          onMouseDown={(e) => e.preventDefault()}
          onClick={switchKeyboard}
          className="h-7 rounded-md border px-2 text-xs font-semibold text-muted-foreground"
          aria-label={keyboard === 'numeric' ? 'Usar teclado con letras' : 'Usar teclado numérico'}
        >
          {keyboard === 'numeric' ? 'ABC' : '123'}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          className="flex h-11 w-11 items-center justify-center text-muted-foreground"
          aria-label={visible ? 'Ocultar' : 'Mostrar'}
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  )
}
