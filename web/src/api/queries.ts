import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as endpoints from './endpoints'

/** Query hooks. Keys start with the resource name so related data can be refreshed together. */
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: endpoints.listUsers })

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: endpoints.settings, staleTime: 60_000 })

// The front page changes with the clock (due ratings, limits freeing up), so it refreshes every minute.
export const useHome = () => useQuery({ queryKey: ['home'], queryFn: endpoints.home, refetchInterval: 60_000 })

export const useCalendar = (from: string, to: string, includeUnsure = false) =>
  useQuery({
    queryKey: ['calendar', from, to, includeUnsure],
    queryFn: () => endpoints.calendar(from, to, includeUnsure),
    placeholderData: (previous) => previous,
  })

export const useDay = (date: string) => useQuery({ queryKey: ['days', date], queryFn: () => endpoints.day(date), placeholderData: (previous) => previous })

export const useAttacks = (q: endpoints.AttackQuery = {}) => useQuery({ queryKey: ['attacks', q], queryFn: () => endpoints.listAttacks(q) })

export const useMedications = (includeArchived = false) =>
  useQuery({ queryKey: ['medications', { includeArchived }], queryFn: () => endpoints.listMedications(includeArchived) })

export const useIngredients = (includeArchived = false) =>
  useQuery({ queryKey: ['ingredients', { includeArchived }], queryFn: () => endpoints.listIngredients(includeArchived) })

export const useTriggers = (includeArchived = false) =>
  useQuery({ queryKey: ['triggers', { includeArchived }], queryFn: () => endpoints.listTriggers(includeArchived) })

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
