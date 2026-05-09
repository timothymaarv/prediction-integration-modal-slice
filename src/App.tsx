// import { useEffect, useMemo, useState } from 'react'
// import { useDialKit } from 'dialkit'
// import Toast from './components/toast/toast'

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import Integration from "./components/integration/integration"
import type { IntegrationConnectionOutcome } from "./components/integration/integration"
import type { IntegrationView } from "./components/integration/integration-context"
import { SegmentedControl } from "./components/segmented/SegmentedControl"
// import ThemeSwitcher from "./components/theme-switcher/theme-switcher"

function App() {
  const [connectionOutcome, setConnectionOutcome] = useState<IntegrationConnectionOutcome>("success")
  const [integrationView, setIntegrationView] = useState<IntegrationView>("default")

  return (
    <main className='container'>

      <Integration
        connectionOutcome={connectionOutcome}
        onViewChange={setIntegrationView}
      />

      <div className="floatingControls">
        <AnimatePresence initial={false}>
          {integrationView === "connecting" && (
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(8px)", y: 6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <SegmentedControl
                value={connectionOutcome}
                onValueChange={(value) => setConnectionOutcome(value as IntegrationConnectionOutcome)}
                aria-label="Integration connection outcome"
              >
                <SegmentedControl.Item value="success">Success</SegmentedControl.Item>
                <SegmentedControl.Item value="failed">Failed</SegmentedControl.Item>
              </SegmentedControl>
            </motion.div>
          )}
        </AnimatePresence>

        {/* <ThemeSwitcher /> */}
      </div>
      {/* <div className='centerStage' /> */}
    </main>
  )
}

export default App
