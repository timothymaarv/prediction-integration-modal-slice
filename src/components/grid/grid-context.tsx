import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { DotState } from './grid'
import { GRID_SMILE, type GridStateName } from './grid-states'

export interface SmileConfig {
    hitArea: number
    debug: boolean
}

interface GridContextValue {
    state: DotState
    stateName: GridStateName
    setState: (next: DotState) => void
    setStateName: (name: GridStateName) => void
    /** repeats: number of loops (0 = infinite). Stops on last frame when done. */
    playSequence: (frames: DotState[], intervalMs?: number, repeats?: number) => void
    stopSequence: () => void
    /** Hover state — set from the parent hover area */
    isHovered: boolean
    mouseRatio: number
    setHovered: (hovered: boolean) => void
    setMouseRatio: (ratio: number) => void
    /** Smile eye-tracking config from dialkit */
    smileConfig: SmileConfig
    setSmileConfig: (config: SmileConfig) => void
}

const GridContext = createContext<GridContextValue | null>(null)

export function GridProvider({ initial = GRID_SMILE, children }: { initial?: DotState; children: ReactNode }) {
    const [state, _setState] = useState<DotState>(initial)
    const [stateName, setStateName] = useState<GridStateName>('smile')
    const [isHovered, setHovered] = useState(false)
    const [mouseRatio, setMouseRatio] = useState(0.5)
    const [smileConfig, setSmileConfig] = useState<SmileConfig>({ hitArea: 40, debug: false })
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const frameRef = useRef(0)

    const stopSequence = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        frameRef.current = 0
    }, [])

    const playSequence = useCallback((frames: DotState[], intervalMs = 200, repeats = 0) => {
        stopSequence()
        if (frames.length === 0) return

        const totalFrames = repeats > 0 ? frames.length * repeats : 0
        let played = 0

        frameRef.current = 0
        _setState(frames[0])
        played++

        timerRef.current = setInterval(() => {
            frameRef.current = (frameRef.current + 1) % frames.length
            _setState(frames[frameRef.current])
            played++

            if (totalFrames > 0 && played >= totalFrames) {
                // Land on last frame and stop
                clearInterval(timerRef.current!)
                timerRef.current = null
            }
        }, intervalMs)
    }, [stopSequence])

    const setState = useCallback((next: DotState) => {
        stopSequence()
        _setState(next)
    }, [stopSequence])

    return (
        <GridContext.Provider value={{ state, stateName, setState, setStateName, playSequence, stopSequence, isHovered, mouseRatio, setHovered, setMouseRatio, smileConfig, setSmileConfig }}>
            {children}
        </GridContext.Provider>
    )
}

export function useGrid() {
    const ctx = useContext(GridContext)
    if (!ctx) throw new Error('useGrid must be used within a GridProvider')
    return ctx
}
