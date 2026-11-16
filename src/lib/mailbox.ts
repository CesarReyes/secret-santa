import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decryptMessage, encryptMessage, mailboxAccess, type Side } from '@shared/crypto'
import { supabase } from '@/lib/supabase'

export type Message = { id: number; side: Side; text: string; at: string }

export const MAX_MESSAGE = 1000

/**
 * Messages of one anonymous mailbox. The server only ever sees the access value and ciphertext;
 * decryption happens here. Polls while the chat is on screen.
 */
export function useMailbox(secret: string) {
  return useQuery({
    queryKey: ['mailbox', secret],
    refetchInterval: 8_000,
    queryFn: async (): Promise<Message[]> => {
      const access = await mailboxAccess(secret)
      const { data, error } = await supabase.rpc('mailbox_read', { p_access: access, p_after: 0 })
      if (error) throw error
      const rows = data as { id: number; side: Side; ciphertext: string; created_at: string }[]
      const out: Message[] = []
      for (const r of rows) {
        try {
          out.push({ id: r.id, side: r.side, text: await decryptMessage(secret, r.side, r.ciphertext), at: r.created_at })
        } catch {
          // Unreadable rows (tampered, or written with another secret) are skipped.
        }
      }
      return out
    },
  })
}

export function useSendMessage(secret: string, side: Side) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (text: string) => {
      const clean = text.trim().slice(0, MAX_MESSAGE)
      const { error } = await supabase.rpc('mailbox_send', {
        p_access: await mailboxAccess(secret),
        p_side: side,
        p_ciphertext: await encryptMessage(secret, side, clean),
      })
      if (error) throw new Error('No se pudo enviar. Inténtalo de nuevo.')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailbox', secret] }),
  })
}
