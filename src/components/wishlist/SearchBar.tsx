'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface CardResult {
  oracleId: string
  name: string
  set: string
  imageUrl: string | null
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [results, setResults] = useState<CardResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Debounce query changes
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Search API call
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      const performSearch = async () => {
        setLoading(true)
        setError(null)
        try {
          const response = await fetch(`/api/cards/search?q=${encodeURIComponent(debouncedQuery)}`)
          if (!response.ok) {
            throw new Error('Failed to search cards')
          }
          const data = await response.json()
          setResults(data.slice(0, 10)) // Max 10 results
          setShowDropdown(true)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Search failed')
          toast.error('Failed to search cards')
        } finally {
          setLoading(false)
        }
      }

      performSearch()
    } else {
      setResults([])
      setShowDropdown(false)
    }
  }, [debouncedQuery])

  const handleAddCard = async (card: CardResult) => {
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.oracleId }),
      })

      if (!response.ok) {
        throw new Error('Failed to add card to wishlist')
      }

      toast.success(`Added "${card.name}" to wishlist`)
      setQuery('')
      setResults([])
      setShowDropdown(false)

      // Refresh page to show updated wishlist
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add card')
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search for cards (e.g., Black Lotus, Thoughtseize)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true)
            }}
            onBlur={() => {
              // Delay hiding dropdown to allow click events
              setTimeout(() => setShowDropdown(false), 200)
            }}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 mt-2 w-full rounded-md border bg-white shadow-lg">
          <div className="max-h-96 overflow-y-auto">
            {results.map((card) => (
              <button
                key={card.oracleId}
                type="button"
                onClick={() => handleAddCard(card)}
                className="flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-gray-50 last:border-b-0"
              >
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="h-12 w-9 flex-shrink-0 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold">{card.name}</div>
                  <div className="truncate text-sm text-gray-500">{card.set}</div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-sm text-gray-400">Click to add</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showDropdown && debouncedQuery.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 mt-2 w-full rounded-md border bg-white p-4 text-center text-sm text-gray-500 shadow-lg">
          No cards found. Try a different search term.
        </div>
      )}
    </div>
  )
}
