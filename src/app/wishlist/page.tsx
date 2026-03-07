import { CardGrid } from '@/components/wishlist/CardGrid'
import { PriceTable } from '@/components/wishlist/PriceTable'
import { SearchBar } from '@/components/wishlist/SearchBar'
import { getServerUser } from '@/lib/auth-server'
import {
  calculatePriceTrend,
  getBestPrice,
  getLatestPricesForCard,
  getPriceHistory,
  getUserWishlist,
} from '@/lib/wishlist/queries'
import type { WishlistWithPrices } from '@/types/wishlist'

export default async function WishlistPage() {
  const user = await getServerUser()

  // Fetch wishlist items
  const wishlistItems = await getUserWishlist(user.userId)

  // Fetch prices and enrich data for each card
  const cardsWithPrices: WishlistWithPrices[] = await Promise.all(
    wishlistItems.map(async (item) => {
      const prices = await getLatestPricesForCard(item.oracleId)
      const bestPrice = getBestPrice(prices)

      // Calculate price trend (use best price or first available price)
      const currentPrice = bestPrice?.priceBrl ?? Object.values(prices).find((p) => p !== null) ?? null
      let priceTrend = { trend: 'stable' as const, percentChange: null }

      if (currentPrice) {
        const priceHistory = await getPriceHistory(item.oracleId, 100)
        priceTrend = calculatePriceTrend(currentPrice, priceHistory)
      }

      return {
        ...item,
        prices,
        bestPrice,
        priceTrend,
      }
    }),
  )

  return (
    <div className="container mx-auto space-y-8 py-8">
      {/* Page header */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">My Wishlist</h1>
        <p className="text-gray-600">Track prices for your favorite Magic: The Gathering cards</p>
      </div>

      {/* Search bar */}
      <div className="flex justify-center">
        <SearchBar />
      </div>

      {/* Content */}
      {cardsWithPrices.length > 0 ? (
        <div className="space-y-12">
          {/* Card grid view */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold">Card Grid</h2>
            <CardGrid cards={cardsWithPrices} />
          </section>

          {/* Price comparison table */}
          <section>
            <h2 className="mb-4 text-2xl font-semibold">Price Comparison</h2>
            <PriceTable cards={cardsWithPrices} />
          </section>
        </div>
      ) : (
        <CardGrid cards={cardsWithPrices} />
      )}
    </div>
  )
}
