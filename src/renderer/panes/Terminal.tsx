import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { PaneHeader } from '../ui'

export default function Terminal(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const term = new XTerm({
      fontFamily: 'Consolas, "Cascadia Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: '#1a1d21',
        foreground: '#e6e8eb',
        cursor: '#4f46e5'
      }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()

    window.hisho.ptyStart({ cols: term.cols, rows: term.rows })

    const offData = window.hisho.onPtyData((data) => term.write(data))
    const inputDisp = term.onData((data) => window.hisho.ptyInput(data))

    const onResize = (): void => {
      fit.fit()
      window.hisho.ptyResize({ cols: term.cols, rows: term.rows })
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(hostRef.current)

    return () => {
      ro.disconnect()
      offData()
      inputDisp.dispose()
      window.hisho.ptyKill()
      term.dispose()
    }
  }, [])

  return (
    <div className="pane term-pane">
      <PaneHeader
        title="Terminal"
        subtitle="A shell in your claude-projects folder — type “claude” to start chatting."
      />
      <div className="term-host" ref={hostRef} />
    </div>
  )
}
