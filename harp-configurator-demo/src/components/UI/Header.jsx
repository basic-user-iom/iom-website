import { PRODUCT } from '../../config/productConfig.js'

export function Header() {
  return (
    <header className="site-header">
      <p className="brand">{PRODUCT.brand}</p>
      <p className="subtitle">{PRODUCT.subtitle}</p>
      <p className="disclaimer">{PRODUCT.disclaimer}</p>
    </header>
  )
}
