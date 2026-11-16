import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../api-client/client'

/** The text someone is typing, once they have paused. */
function useSettled(value: string, ms = 400) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

/** What laying these overrides over the base's latest version gives, worked out by the backend as they are typed. */
export function useMerged(baseId: string | undefined, overrides: string, enabled: boolean) {
  const settled = useSettled(overrides)
  return useQuery({
    queryKey: ['config-merge', baseId, settled],
    queryFn: () => api.mergeConfig(baseId!, settled),
    enabled: enabled && baseId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
  })
}
