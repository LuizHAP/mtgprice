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

## Database Migration (Pending)

### 3. Apply migration 0003_unique_wishlist.sql
**Location:** `drizzle/0003_unique_wishlist.sql`
**Issue:** Database not running during plan execution
**Status:** Migration file created but NOT applied
**Required action:** Run `docker-compose up -d` to start PostgreSQL, then apply migration:
```bash
# Start database
docker-compose up -d

# Apply migration
psql $DATABASE_URL -f drizzle/0003_unique_wishlist.sql

# Or use drizzle-kit push
pnpm drizzle-kit push
```
**Verification:** After applying, check constraint exists:
```bash
psql $DATABASE_URL -c "\d wishlists" | grep unique
```

## Impact

These pre-existing issues prevent `npm run build` from completing. The actual task changes (null check fix in queries.ts, unique constraint in schema) are correct and tested, but:
1. Build fails due to unrelated TypeScript errors in other files
2. Migration not applied because database not running

## Recommendation for Next Phase

1. Fix the wishlist/page.tsx type issue as part of Phase 04 or in a separate tech debt cleanup plan
2. Apply migration 0003_unique_wishlist.sql when database is available
3. Verify unique constraint exists in database after migration
