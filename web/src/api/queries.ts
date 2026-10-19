import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as endpoints from './endpoints'

/** Query hooks. Keys start with the resource name so related data can be refreshed together. */
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: endpoints.listUsers })

/**
 * A mutation that refreshes all cached data afterwards. One dose or reading changes limits, the
 * calendar and statistics at once, so refreshing everything is the simple, correct choice for a personal app.
 * The refresh isn't awaited: callers (e.g. a form resetting itself) continue as soon as the
 * server has confirmed the change.
 */
export function useApiMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // Photos are cached by version and never go stale.
      void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'images' })
    },
  })
}
