import { useQuery } from '@tanstack/react-query'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { api, getToken } from '../../api-client/client'
import { ErrorNote } from '../../components/ui'

/**
 * The API reference, shown with Swagger UI from the OpenAPI document the backend serves. Loaded only when this tab
 * is opened (see Developer.tsx): Swagger UI is large. "Try it out" sends real requests as the signed-in user.
 */
export default function ApiReference() {
  const spec = useQuery({ queryKey: ['openapi'], queryFn: api.openapi, staleTime: Infinity })
  if (spec.error) return <ErrorNote error={spec.error} />
  if (!spec.data) return <p className="text-muted">Loading the API reference…</p>
  return (
    // Swagger UI has only a light theme, so it sits on its own light panel in both console themes.
    <div className="api-docs card overflow-hidden">
      <SwaggerUI
        spec={spec.data}
        docExpansion="none"
        defaultModelsExpandDepth={-1}
        requestInterceptor={(req) => {
          // "Try it out" acts as whoever is signed in to the console, unless a token was entered under Authorize.
          const token = getToken()
          if (token && !req.headers.Authorization) req.headers.Authorization = `Bearer ${token}`
          return req
        }}
      />
    </div>
  )
}
