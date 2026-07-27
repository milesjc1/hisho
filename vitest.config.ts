import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: { alias: { electron: resolve(__dirname, 'src/test/electron-stub.ts') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
})
