'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { WishlistWithPrices } from '@/types/wishlist'
import Link from 'next/link'
import { useState } from 'react'

interface PriceTableProps {
  cards: WishlistWithPrices[]
}

type SortColumn = 'name' | 'ligaMagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom' | 'best'
type SortDirection = 'asc' | 'desc'

export function PriceTable({ cards }: PriceTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const formatPrice = (price: number | null) => {
    if (!price) return '-'
    return `R$ ${price.toFixed(2)}`
  }

  const getBestPrice = (card: WishlistWithPrices) => {
    if (!card.bestPrice) return null
    const prices = [
      card.prices.ligaMagic,
      card.prices.tcgplayer,
      card.prices.cardmarket,
      card.prices.cardkingdom,
    ].filter((price): price is number => price !== null)

    if (prices.length === 0) return null
    return Math.min(...prices)
  }

  const sortedCards = [...cards].sort((a, b) => {
    let compareValueA: string | number
    let compareValueB: string | number

    switch (sortColumn) {
      case 'name':
        compareValueA = a.name.toLowerCase()
        compareValueB = b.name.toLowerCase()
        break
      case 'ligaMagic':
        compareValueA = a.prices.ligaMagic ?? Number.POSITIVE_INFINITY
        compareValueB = b.prices.ligaMagic ?? Number.POSITIVE_INFINITY
        break
      case 'tcgplayer':
        compareValueA = a.prices.tcgplayer ?? Number.POSITIVE_INFINITY
        compareValueB = b.prices.tcgplayer ?? Number.POSITIVE_INFINITY
        break
      case 'cardmarket':
        compareValueA = a.prices.cardmarket ?? Number.POSITIVE_INFINITY
        compareValueB = b.prices.cardmarket ?? Number.POSITIVE_INFINITY
        break
      case 'cardkingdom':
        compareValueA = a.prices.cardkingdom ?? Number.POSITIVE_INFINITY
        compareValueB = b.prices.cardkingdom ?? Number.POSITIVE_INFINITY
        break
      case 'best':
        compareValueA = getBestPrice(a) ?? Number.POSITIVE_INFINITY
        compareValueB = getBestPrice(b) ?? Number.POSITIVE_INFINITY
        break
      default:
        compareValueA = a.name.toLowerCase()
        compareValueB = b.name.toLowerCase()
    }

    if (compareValueA < compareValueB) {
      return sortDirection === 'asc' ? -1 : 1
    }
    if (compareValueA > compareValueB) {
      return sortDirection === 'asc' ? 1 : -1
    }
    return 0
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort(column)}>
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column && (
          <span className="text-xs text-gray-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </TableHead>
  )

  if (cards.length === 0) {
    return <div className="rounded-lg border p-8 text-center text-gray-500">No cards to display</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader column="name">Card</SortableHeader>
            <SortableHeader column="ligaMagic">Liga Magic</SortableHeader>
            <SortableHeader column="tcgplayer">TCGPlayer</SortableHeader>
            <SortableHeader column="cardmarket">CardMarket</SortableHeader>
            <SortableHeader column="cardkingdom">CardKingdom</SortableHeader>
            <SortableHeader column="best">Best</SortableHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCards.map((card) => {
            const bestPrice = getBestPrice(card)

            return (
              <TableRow key={card.oracleId}>
                <TableCell className="font-medium">
                  <Link href={`/cards/${card.oracleId}`} className="hover:text-blue-600 hover:underline">
                    {card.name}
                  </Link>
                  <div className="text-xs text-gray-500">{card.set}</div>
                </TableCell>
                <TableCell
                  className={
                    bestPrice && card.prices.ligaMagic === bestPrice ? 'font-bold text-green-600' : ''
                  }
                >
                  {formatPrice(card.prices.ligaMagic)}
                </TableCell>
                <TableCell
                  className={
                    bestPrice && card.prices.tcgplayer === bestPrice ? 'font-bold text-green-600' : ''
                  }
                >
                  {formatPrice(card.prices.tcgplayer)}
                </TableCell>
                <TableCell
                  className={
                    bestPrice && card.prices.cardmarket === bestPrice ? 'font-bold text-green-600' : ''
                  }
                >
                  {formatPrice(card.prices.cardmarket)}
                </TableCell>
                <TableCell
                  className={
                    bestPrice && card.prices.cardkingdom === bestPrice ? 'font-bold text-green-600' : ''
                  }
                >
                  {formatPrice(card.prices.cardkingdom)}
                </TableCell>
                <TableCell className="font-bold text-green-600">{formatPrice(bestPrice)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
