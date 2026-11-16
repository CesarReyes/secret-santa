import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Snow } from '@/components/Snow'

/** Red, snowy full-screen frame for sign-in, sign-up and PIN screens. */
export function AuthLayout({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-primary px-4 py-[max(env(safe-area-inset-top),2rem)]">
      <Snow />
      <Card className="relative w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="text-5xl" aria-hidden>🎁</span>
          <CardTitle className="font-display text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
