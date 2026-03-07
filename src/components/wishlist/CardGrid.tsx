'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { WishlistWithPrices } from '@/types/wishlist'
import { Minus, TrendingDown, TrendingUp, X } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from './EmptyState'

interface CardGridProps {
  cards: WishlistWithPrices[]
}

export function CardGrid({ cards }: CardGridProps) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  if (cards.length === 0) {
    return <EmptyState />
  }

  const handleToggleCard = (oracleId: string) => {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(oracleId)) {
      newSelected.delete(oracleId)
    } else {
      newSelected.add(oracleId)
    }
    setSelectedCards(newSelected)
  }

  const handleRemoveCard = async (oracleId: string) => {
    try {
      const response = await fetch(`/api/wishlist/${oracleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove card')
      }

      toast.success('Card removed from wishlist')
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove card')
    }
  }

  const handleBulkRemove = async () => {
    try {
      const promises = Array.from(selectedCards).map((oracleId) =>
        fetch(`/api/wishlist/${oracleId}`, { method: 'DELETE' }),
      )

      const results = await Promise.all(promises)
      const allSuccessful = results.every((r) => r.ok)

      if (!allSuccessful) {
        throw new Error('Some cards failed to remove')
      }

      toast.success(`Removed ${selectedCards.size} cards from wishlist`)
      setShowConfirmDialog(false)
      setSelectedCards(new Set())
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove cards')
    }
  }

  const getTrendIcon = (trend: WishlistWithPrices['priceTrend']) => {
    if (trend.trend === 'up') return <TrendingUp className="h-4 w-4 text-red-500" />
    if (trend.trend === 'down') return <TrendingDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `R$ ${price.toFixed(2)}`
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.oracleId} className="relative overflow-hidden p-4">
            {/* Checkbox for bulk selection */}
            <div className="absolute left-2 top-2 z-10">
              <Checkbox
                checked={selectedCards.has(card.oracleId)}
                onCheckedChange={() => handleToggleCard(card.oracleId)}
                className="border-white bg-black/50 data-[state=checked]:bg-white data-[state=checked]:text-black"
              />
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemoveCard(card.oracleId)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-red-500"
              aria-label="Remove card"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Card image */}
            <div className="relative mb-3 aspect-[488/680] w-full overflow-hidden rounded bg-gray-100">
              {card.imageUrl ? (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    // Fallback to placeholder on error
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">No image</div>
              )}
            </div>

            {/* Card info */}
            <div className="space-y-1">
              <h3 className="truncate font-semibold" title={card.name}>
                {card.name}
              </h3>
              <p className="truncate text-sm text-gray-500" title={card.set}>
                {card.set}
              </p>

              {/* Best price */}
              {card.bestPrice && (
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm">
                    <span className="text-gray-600">Best: </span>
                    <span className="font-bold text-green-600">{formatPrice(card.bestPrice.priceBrl)}</span>
                  </div>
                  <div className="text-xs text-gray-500">{card.bestPrice.source}</div>
                </div>
              )}

              {/* Price trend */}
              {card.priceTrend.percentChange !== null && (
                <div className="flex items-center gap-1 text-xs">
                  {getTrendIcon(card.priceTrend)}
                  <span
                    className={
                      card.priceTrend.trend === 'down'
                        ? 'text-green-600'
                        : card.priceTrend.trend === 'up'
                          ? 'text-red-600'
                          : 'text-gray-400'
                    }
                  >
                    {card.priceTrend.percentChange > 0
                      ? `+${card.priceTrend.percentChange.toFixed(1)}%`
                      : `${card.priceTrend.percentChange.toFixed(1)}%`}
                  </span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Bulk remove button */}
      {selectedCards.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button size="lg" onClick={() => setShowConfirmDialog(true)} className="shadow-lg">
            Remove Selected ({selectedCards.size})
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Selected Cards</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedCards.size} cards from your wishlist? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkRemove}>
              Remove {selectedCards.size} Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
