import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function EmptyState() {
  const suggestedCards = [
    { name: 'Sheoldred, the Apocalypse', set: 'Standard staple' },
    { name: 'Thoughtseize', set: 'Modern staple' },
    { name: 'Orcish Bowmasters', set: 'Modern staple' },
    { name: 'Hullbreaker Horror', set: 'Commander staple' },
  ]

  const handleQuickAdd = (cardName: string) => {
    // Trigger SearchBar with pre-filled query
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
    if (searchInput) {
      searchInput.value = cardName
      searchInput.focus()
      // Trigger input event to start search
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return (
    <Card className="p-12 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center space-y-6">
        {/* Icon/illustration */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
          <span className="text-4xl" role="img" aria-label="Empty wishlist">
            📋
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Your wishlist is empty</h2>
          <p className="text-gray-600">Start tracking cards by searching above or try these popular cards:</p>
        </div>

        {/* Suggested cards */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestedCards.map((card) => (
            <Button
              key={card.name}
              variant="outline"
              onClick={() => handleQuickAdd(card.name)}
              className="h-auto justify-start px-4 py-3"
            >
              <div className="text-left">
                <div className="font-semibold">{card.name}</div>
                <div className="text-xs text-gray-500">{card.set}</div>
              </div>
            </Button>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-sm text-gray-500">
          Click a suggestion above or use the search bar to add cards
        </div>
      </div>
    </Card>
  )
}
