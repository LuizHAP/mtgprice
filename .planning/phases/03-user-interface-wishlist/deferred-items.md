# Deferred Items - Phase 03-05

The following pre-existing issues were discovered during plan execution but are out of scope per deviation rules (not caused by current task changes):

## Build Errors (Pre-existing)

### 1. page.tsx Button asChild prop error
**Location:** `src/app/page.tsx:46`
**Issue:** Button component doesn't support `asChild` prop from @base-ui/react
**Error:** Type error: Property 'asChild' does not exist on Button component
**Status:** Fixed during execution (Rule 3 - blocking issue)
**Note:** Changed Button usage from `<Button asChild><Link>` to `<Link><Button>`

### 2. wishlist/page.tsx Type mismatch
**Location:** `src/app/wishlist/page.tsx:21`
**Issue:** Type mismatch in WishlistWithPrices - missing properties `id` and `lastFetched`
**Error:** Type is not assignable to WishlistWithPrices[] - missing id, lastFetched properties
**Status:** NOT FIXED - out of scope (pre-existing, not caused by Task 1 changes)
**Recommendation:** Update WishlistWithPrices type definition or fix the type assertion in wishlist/page.tsx

## Impact

These pre-existing issues prevent `npm run build` from completing. The actual task changes (null check fix in queries.ts) are correct and tested, but the build fails due to unrelated TypeScript errors in other files.

## Recommendation for Next Phase

Fix the wishlist/page.tsx type issue as part of Phase 04 or in a separate tech debt cleanup plan.
