const path = require('path')
const { loadNuxt } = require('nuxt')
const puppeteer = require('puppeteer')
const getPort = require('get-port')

describe('e2e', () => {
  let url, nuxt, browser

  beforeAll(async () => {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    })

    nuxt = await loadNuxt({
      for: 'start',
      rootDir: path.resolve(__dirname, 'fixture')
    })

    const port = await getPort()
    url = p => `http://localhost:${port}${p}`
    await nuxt.listen(port)
  })

  afterAll(async () => {
    await browser.close()
    await nuxt.close()
  })

  test('initial state', async () => {
    const page = await browser.newPage()
    await page.goto(url('/'))

    const strapiInstance = await page.evaluate(() => window.__NUXT__.strapi)
    expect(strapiInstance).toBeTruthy()

    await page.close()
  })
})
