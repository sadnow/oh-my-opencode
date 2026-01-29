import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/usage', () => {
    return HttpResponse.json([])
  }),
  http.get('/api/config', () => {
    return HttpResponse.json({ budget: { enabled: false } })
  }),
  http.get('/api/export/usage', () => {
    return HttpResponse.json([])
  })
]
