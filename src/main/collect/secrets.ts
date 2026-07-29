import { readFileSync } from 'fs'
import { join } from 'path'
import type { Secrets } from './types'

/**
 * Load collector credentials. Precedence: environment variables first, then a
 * local JSON file at `%APPDATA%\Hisho\credentials.json` (same dir as the DB,
 * outside the repo — never committed). Missing creds just disable that source;
 * collectAll reports it as an error rather than throwing.
 */
export function loadSecrets(): Secrets {
  const file = credentialsPath()
  let fromFile: Partial<RawCreds> = {}
  try {
    fromFile = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* no file / unreadable — env-only is fine */
  }

  const env = process.env
  const slackUserToken = env.SLACK_USER_TOKEN || fromFile.slackUserToken

  return { slackUserToken }
}

interface RawCreds {
  slackUserToken?: string
}

function credentialsPath(): string {
  if (process.env.HISHO_CREDENTIALS) return process.env.HISHO_CREDENTIALS
  const base = process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  return join(base, 'Hisho', 'credentials.json')
}
