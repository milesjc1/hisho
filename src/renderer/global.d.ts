import type { HishoApi } from '../preload/index'
import type { JSX as ReactJSX } from 'react'

// React 19 dropped the global JSX namespace in favour of React.JSX.
// Re-expose it globally so `: JSX.Element` annotations keep resolving.
declare global {
  interface Window {
    hisho: HishoApi
  }

  namespace JSX {
    type Element = ReactJSX.Element
    type ElementClass = ReactJSX.ElementClass
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
    type IntrinsicElements = ReactJSX.IntrinsicElements
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
  }
}

export {}
