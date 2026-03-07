import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getServerUser } from '@/lib/auth-server'
import { getUserWishlist } from '@/lib/wishlist/queries'
import Link from 'next/link'

export default async function HomePage() {
  // Try to get user, but don't fail if not authenticated
  let wishlistSize = 0
  try {
    const user = await getServerUser()
    const wishlist = await getUserWishlist(user.userId)
    wishlistSize = wishlist.length
  } catch {
    // User not authenticated, wishlistSize remains 0
  }

  return (
    <div className="container mx-auto py-16">
      {/* Hero section */}
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight">MTG Price Monitor</h1>
        <p className="mb-8 text-xl text-gray-600">
          Track Magic: The Gathering card prices across multiple sources. Get notified when prices drop and
          find the best deals.
        </p>

        {/* Quick stats */}
        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="p-6">
            <div className="text-4xl font-bold text-blue-600">{wishlistSize}</div>
            <div className="text-sm text-gray-600">Cards in Wishlist</div>
          </Card>
          <Card className="p-6">
            <div className="text-4xl font-bold text-green-600">4</div>
            <div className="text-sm text-gray-600">Price Sources</div>
          </Card>
          <Card className="p-6">
            <div className="text-4xl font-bold text-purple-600">2-3x</div>
            <div className="text-sm text-gray-600">Daily Price Checks</div>
          </Card>
        </div>

        {/* Call to action */}
        <div className="flex justify-center gap-4">
          <Link href="/wishlist">
            <Button size="lg">View Wishlist</Button>
          </Link>
          <Link href="/about">
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <div className="text-2xl">🔍</div>
            <h3 className="font-semibold">Card Search</h3>
            <p className="text-sm text-gray-600">Search and add cards to your wishlist with autocomplete</p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">💰</div>
            <h3 className="font-semibold">Price Comparison</h3>
            <p className="text-sm text-gray-600">
              Compare prices across 4 sources: Liga Magic, TCGPlayer, CardMarket, CardKingdom
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">📈</div>
            <h3 className="font-semibold">Price Trends</h3>
            <p className="text-sm text-gray-600">
              Track price changes with trend indicators and percentage changes
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">🔔</div>
            <h3 className="font-semibold">Notifications</h3>
            <p className="text-sm text-gray-600">Get notified via Telegram when prices drop (coming soon)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
