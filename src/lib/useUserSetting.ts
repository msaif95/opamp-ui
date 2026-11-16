import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api-client/client'
import { toast } from './toast'

/** One of the signed-in person's own console settings, kept on the server so it follows them between browsers. */
export function useUserSetting<T>(key: 'fleet_views' | 'overview_cards') {
  const qc = useQueryClient()
  const queryKey = ['user-setting', key]
  const query = useQuery({ queryKey, queryFn: () => api.userSetting<T>(key), staleTime: 60_000 })
  const save = useMutation({
    mutationFn: (value: T[]) => api.saveUserSetting(key, value),
    // Shown at once; put back if the server refuses.
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, { value })
      return { previous }
    },
    onError: (e, _value, context) => {
      qc.setQueryData(queryKey, context?.previous)
      toast({ title: 'Could not save', body: e.message, tone: 'danger' })
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })
  return { value: query.data?.value, loaded: query.data !== undefined, save: save.mutate, saving: save.isPending }
}
