/// <reference types="vite/client" />

// swagger-ui-react ships no types; this is the part the console uses.
declare module 'swagger-ui-react' {
  import type { ComponentType } from 'react'
  const SwaggerUI: ComponentType<{
    spec?: object
    docExpansion?: 'list' | 'full' | 'none'
    defaultModelsExpandDepth?: number
    tryItOutEnabled?: boolean
    requestInterceptor?: (req: { headers: Record<string, string> }) => unknown
  }>
  export default SwaggerUI
}
