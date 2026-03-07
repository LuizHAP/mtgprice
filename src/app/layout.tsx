import type { Metadata } from 'next'
import './globals.css'
import { cn } from '@/lib/utils'
import { Geist } from 'next/font/google'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'MTG Price Monitor',
  description: 'Track Magic: The Gathering card prices across multiple sources',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body>{children}</body>
    </html>
  )
}
