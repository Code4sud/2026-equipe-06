import { httpApi, type Api } from './http'
import { mockApi } from './mock'

// Mock by default until the backend is ready.
// Set VITE_USE_MOCK=false in frontend/.env.local to call the real Flask API.
export const api: Api = import.meta.env.VITE_USE_MOCK === 'false' ? httpApi : mockApi

export { ApiError } from './http'
