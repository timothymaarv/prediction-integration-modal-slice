// import { useEffect, useMemo, useState } from 'react'
// import { useDialKit } from 'dialkit'
// import Toast from './components/toast/toast'

import Integration from "./components/integration/integration"
import OrderForm from "./components/order-form/order-form"
import OrderInput from "./components/order-input/order-input"
import ThemeSwitcher from "./components/theme-switcher/theme-switcher"

function App() {

  return (
    <main className='container'>

      {/* <OrderInput /> */}
      {/* <OrderForm /> */}
      <Integration />


      {/* <ThemeSwitcher /> */}
      {/* <div className='centerStage' /> */}
    </main>
  )
}

export default App
