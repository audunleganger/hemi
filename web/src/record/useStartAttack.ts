import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation } from '../api/queries'
import type { StartAttackInput } from '../api/types.gen'
import { useToast } from '../components/Toast'
import { formatMomentDay } from '../lib/time'

/** Starts an attack; when it joins an earlier one as a recurrence (AT-7), says so and offers Undo. */
export function useStartAttack() {
  const { t } = useTranslation()
  const toast = useToast()
  const split = useApiMutation(({ attackId, episodeId }: { attackId: number; episodeId: number }) => endpoints.splitEpisode(attackId, episodeId))
  const start = useApiMutation((input: StartAttackInput) => endpoints.startAttack(input))
  return {
    ...start,
    mutate(input: StartAttackInput, options?: { onSuccess?: () => void }) {
      start.mutate(input, {
        onSuccess: (result) => {
          if (result.recurrenceOf !== null) {
            const first = result.attack.episodes[0]
            toast.show(t('start.recurrence', { day: formatMomentDay(first.start) }), {
              label: t('common.undo'),
              run: () => split.mutate({ attackId: result.attack.summary.id, episodeId: result.episodeId }),
            })
          } else {
            toast.show(t('start.started'))
          }
          options?.onSuccess?.()
        },
      })
    },
  }
}
