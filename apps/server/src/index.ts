import { CreateJobSchema } from '@repo/schemas'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/createjob', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = CreateJobSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  return c.json({ status: 'ok', data: parsed.data })
})

const port = Number(process.env.PORT) || 9191

const server = serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

// graceful shutdown
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})