import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fair Share',
  description: 'Chore distribution MVP',
}

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode
}) {
  return (
      <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 min-h-screen flex flex-col`}>
      {/* Navigation Tabs */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 md:px-12">
          <nav className="flex space-x-8">
            <Link href="/" className="py-4 px-2 border-b-2 border-blue-600 text-blue-600 font-semibold">
              Home
            </Link>
            <Link href="/schedule" className="py-4 px-2 border-b-2 border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-700 font-semibold transition">
              Schedule
            </Link>
            <Link href="/settings" className="py-4 px-2 border-b-2 border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-700 font-semibold transition">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>
      </body>
      </html>
  )
}