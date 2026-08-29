import { Component } from 'react'

export class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[harp-configurator] scene failed', error, info)
    if (!this.props.silent) this.props.onError?.(error)
  }

  render() {
    if (this.state.error) return null
    return this.props.children
  }
}
