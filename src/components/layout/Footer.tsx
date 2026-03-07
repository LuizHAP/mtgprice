import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container py-6 text-center text-sm text-gray-600">
        <p>&copy; {new Date().getFullYear()} MTG Price Monitor. All rights reserved.</p>
        <p className="mt-2">Track Magic: The Gathering card prices across multiple sources.</p>
        <div className="mt-4 space-x-4">
          <Link href="/about" className="hover:text-gray-900">
            About
          </Link>
          <span>|</span>
          <Link href="/wishlist" className="hover:text-gray-900">
            Wishlist
          </Link>
        </div>
      </div>
    </footer>
  )
}
