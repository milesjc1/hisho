import { notify } from './notify'
import { countState, getSetting } from './db'

let timer: ReturnType<typeof setInterval> | null = null

export function isWorkHours(d: Date, startHr: number, endHr: number): boolean {
  const h = d.getHours()
  return h >= startHr && h < endHr
}

function num(key: string, def: number): number {
  const n = Number(getSetting(key))
  return Number.isFinite(n) && n > 0 ? n : def
}

export function startNag(): void {
  const hours = num('nagHours', 3)
  const tick = (): void => {
    if (!isWorkHours(new Date(), num('workStart', 9), num('workEnd', 18))) return
    const active = countState('active')
    const back = countState('backburner')
    if (active + back === 0) return
    notify('On your plate', `${active} active · ${back} backburner`)
  }
  if (!timer) timer = setInterval(tick, hours * 3_600_000)
}

export function stopNag(): void {
  if (timer) clearInterval(timer)
  timer = null
}
