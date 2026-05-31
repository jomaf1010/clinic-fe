import { ApolloClient, InMemoryCache, createHttpLink, from, fromPromise } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { getAuthToken, refreshAccessToken, SESSION_ID } from '@/lib/http'

const BASE_URL = import.meta.env.VITE_API_URL as string

// GraphQL lives under the same /api umbrella as REST (shared proxy/CORS/auth).
const httpLink = createHttpLink({
  uri: `${BASE_URL}/graphql`,
  credentials: 'include',
})

// Mirror the REST auth: the in-memory access token (kept fresh by the REST
// 401-refresh flow in http.ts) + the per-tab session id.
const authLink = setContext((_, { headers }) => {
  const token = getAuthToken()
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Session-Id': SESSION_ID,
    },
  }
})

// Share REST's 401 recovery: on an expired token, refresh once (single-flight,
// dedup'd with the REST flow) and retry. If refresh fails (e.g. logged-out-all),
// the error propagates and the REST layer drives the user to /login.
const errorLink = onError(({ networkError, operation, forward }) => {
  const status = (networkError as { statusCode?: number } | null)?.statusCode
  if (status !== 401 || operation.getContext().authRetried) {
    return
  }

  operation.setContext({ authRetried: true })

  return fromPromise(
    refreshAccessToken().then((refreshed) => {
      if (!refreshed) {
        throw networkError ?? new Error('Unauthorized')
      }
    }),
  ).flatMap(() => forward(operation))
})

/**
 * Read-only GraphQL client. Writes stay on REST, so we deliberately bypass the
 * normalized cache (network-only) — the win here is request aggregation, and
 * network-only avoids stale reads after a REST mutation without manual eviction.
 */
export const apollo = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
  },
})
