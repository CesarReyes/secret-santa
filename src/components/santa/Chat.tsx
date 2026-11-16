import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Lock, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import type { Side } from '@shared/crypto'
import { Button } from '@/components/ui/button'
import { MAX_MESSAGE, useMailbox, useSendMessage } from '@/lib/mailbox'
import { cn } from '@/lib/utils'

type Props = {
  secret: string
  side: Side
  /** Shown above the bubbles of the other side, e.g. "Lucía" or "Tu amigo secreto". */
  otherName: string
  intro: string
  placeholder: string
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Chat({ secret, side, otherName, intro, placeholder }: Props) {
  const { data: messages = [], isPending } = useMailbox(secret)
  const send = useSendMessage(secret, side)
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)

  // Keep the newest message in view without scrolling the whole page.
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await send.mutateAsync(text)
      setText('')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {intro}
      </p>
      <div ref={list} className="max-h-[50dvh] min-h-32 space-y-2 overflow-y-auto rounded-xl border bg-muted/40 p-3" aria-live="polite">
        {isPending ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay mensajes.</p>
        ) : (
          messages.map((m) => {
            const mine = m.side === side
            return (
              <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                {!mine && <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{otherName}</span>}
                <p
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-[15px] whitespace-pre-wrap break-words',
                    mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border bg-card',
                  )}
                >
                  {m.text}
                </p>
                <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{time(m.at)}</span>
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={placeholder}
          maxLength={MAX_MESSAGE}
          rows={1}
          aria-label="Mensaje"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-xl" disabled={!text.trim() || send.isPending} aria-label="Enviar">
          <SendHorizontal />
        </Button>
      </form>
    </div>
  )
}
