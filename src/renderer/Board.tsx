import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import Panel from './Panel'
import ItemCard from './ItemCard'

const api = window.hisho

export default function Board(): JSX.Element {
  const [center, setCenter] = useState<Item[]>([])
  const [back, setBack] = useState<Item[]>([])
  const [resp, setResp] = useState<Item[]>([])
  const [staleDays, setStaleDays] = useState(3)

  const load = (): void => {
    void Promise.all([api.center(), api.backburner(), api.responded()]).then(([c, b, r]) => {
      setCenter(c)
      setBack(b)
      setResp(r)
    })
    void api.getSetting('staleDays').then((v) => {
      if (v != null) setStaleDays(Number(v))
    })
  }

  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  const newItems = center.filter((i) => i.state === 'new')
  const activeItems = center.filter((i) => i.state !== 'new')

  return (
    <div className="board">
      <Panel title="Backburner" count={back.length} state="backburner">
        {back.length === 0 && <div className="panel-empty">Nothing parked.</div>}
        {back.map((i) => (
          <ItemCard key={i.id} item={i} />
        ))}
      </Panel>

      <Panel title="Active" count={center.length} state="active" className="center">
        {newItems.map((i) => (
          <ItemCard key={i.id} item={i} showSort />
        ))}
        {newItems.length > 0 && activeItems.length > 0 && <hr className="divider" />}
        {activeItems.map((i) => (
          <ItemCard key={i.id} item={i} />
        ))}
        {center.length === 0 && <div className="panel-empty">All clear.</div>}
      </Panel>

      <Panel title="Responded" count={resp.length} state="responded">
        {resp.length === 0 && <div className="panel-empty">Nothing awaiting a reply.</div>}
        {resp.map((i) => (
          <ItemCard key={i.id} item={i} staleDays={staleDays} />
        ))}
      </Panel>
    </div>
  )
}
