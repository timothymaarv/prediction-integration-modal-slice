// import { useEffect, useMemo, useState } from 'react'
// import { useDialKit } from 'dialkit'
// import Toast from './components/toast/toast'

import { useState } from "react"
import Integration from "./components/integration/integration"
import type { IntegrationConnectionOutcome } from "./components/integration/integration"
import { SegmentedControl } from "./components/segmented/SegmentedControl"
import ThemeSwitcher from "./components/theme-switcher/theme-switcher"

function App() {
  const [connectionOutcome, setConnectionOutcome] = useState<IntegrationConnectionOutcome>("success")

  return (
    <main className='container'>

      <Integration connectionOutcome={connectionOutcome} />

      <div className="floatingControls">
        <SegmentedControl
          value={connectionOutcome}
          onValueChange={(value) => setConnectionOutcome(value as IntegrationConnectionOutcome)}
          aria-label="Integration connection outcome"
        >
          <SegmentedControl.Item value="success">Success</SegmentedControl.Item>
          <SegmentedControl.Item value="failed">Failed</SegmentedControl.Item>
        </SegmentedControl>

        <ThemeSwitcher />
      </div>
      {/* <div className='centerStage' /> */}
    </main>
  )
}

export default App
