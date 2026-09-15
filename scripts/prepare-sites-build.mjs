import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const distDirectory = resolve(projectRoot, 'dist')
const clientDirectory = resolve(distDirectory, 'client')
const serverDirectory = resolve(distDirectory, 'server')
const hostingDirectory = resolve(distDirectory, '.openai')

const workerSource = `const isPageNavigation = (request) =>
  request.method === 'GET' &&
  (request.headers.get('accept') ?? '').includes('text/html')

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)

    if (response.status !== 404 || !isPageNavigation(request)) {
      return response
    }

    const fallbackUrl = new URL('/index.html', request.url)
    return env.ASSETS.fetch(new Request(fallbackUrl, request))
  },
}
`

await mkdir(clientDirectory, { recursive: true })
await cp(resolve(distDirectory, 'index.html'), resolve(distDirectory, '404.html'))
const outputEntries = await readdir(distDirectory, { withFileTypes: true })
await Promise.all(
  outputEntries
    .filter(({ name }) => !['client', 'server', '.openai'].includes(name))
    .map(({ name }) =>
      cp(resolve(distDirectory, name), resolve(clientDirectory, name), { recursive: true }),
    ),
)

await mkdir(serverDirectory, { recursive: true })
await writeFile(resolve(serverDirectory, 'index.js'), workerSource)

await mkdir(hostingDirectory, { recursive: true })
const hosting = await readFile(resolve(projectRoot, '.openai', 'hosting.json'))
await writeFile(resolve(hostingDirectory, 'hosting.json'), hosting)
