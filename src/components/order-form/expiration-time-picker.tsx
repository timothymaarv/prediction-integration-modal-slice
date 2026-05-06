import { useCallback, useEffect, useRef } from "react"
import styles from "./expiration-time-picker.module.css"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function pad(n: number): string {
    return n.toString().padStart(2, "0")
}

type ScrollColumnProps = {
    values: number[]
    selected: number
    onSelect: (value: number) => void
}

function ScrollColumn({ values, selected, onSelect }: ScrollColumnProps) {
    const columnRef = useRef<HTMLDivElement>(null)
    const isUserScrolling = useRef(false)
    const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => {
        const col = columnRef.current
        if (!col || isUserScrolling.current) return
        const cell = col.children[selected] as HTMLElement | undefined
        if (cell) {
            col.scrollTo({ top: cell.offsetTop - col.offsetHeight / 2 + cell.offsetHeight / 2, behavior: "instant" })
        }
    }, [selected])

    const handleScroll = useCallback(() => {
        isUserScrolling.current = true
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current)

        scrollTimeout.current = setTimeout(() => {
            isUserScrolling.current = false
            const col = columnRef.current
            if (!col) return

            const center = col.scrollTop + col.offsetHeight / 2
            let closest = 0
            let closestDist = Infinity
            for (let i = 0; i < col.children.length; i++) {
                const child = col.children[i] as HTMLElement
                const childCenter = child.offsetTop + child.offsetHeight / 2
                const dist = Math.abs(center - childCenter)
                if (dist < closestDist) {
                    closestDist = dist
                    closest = i
                }
            }
            if (values[closest] !== selected) {
                onSelect(values[closest])
            }
        }, 80)
    }, [values, selected, onSelect])

    return (
        <div ref={columnRef} className={styles.column} onScroll={handleScroll}>
            {values.map((v) => (
                <button
                    key={v}
                    type="button"
                    className={`${styles.cell} ${v === selected ? styles.cellActive : ""}`}
                    onClick={() => {
                        onSelect(v)
                        const col = columnRef.current
                        const idx = values.indexOf(v)
                        if (col && col.children[idx]) {
                            const cell = col.children[idx] as HTMLElement
                            col.scrollTo({ top: cell.offsetTop - col.offsetHeight / 2 + cell.offsetHeight / 2, behavior: "smooth" })
                        }
                    }}
                >
                    {pad(v)}
                </button>
            ))}
        </div>
    )
}

type ExpirationTimePickerProps = {
    hours: number
    minutes: number
    onChangeHours: (h: number) => void
    onChangeMinutes: (m: number) => void
    onClose: () => void
}

export default function ExpirationTimePicker({
    hours,
    minutes,
    onChangeHours,
    onChangeMinutes,
    onClose,
}: ExpirationTimePickerProps) {
    return (
        <>
            <div className={styles.timePickerOverlay} onClick={onClose} />
            <div className={styles.timePickerWrapper}>
                <ScrollColumn values={HOURS} selected={hours} onSelect={onChangeHours} />
                <ScrollColumn values={MINUTES} selected={minutes} onSelect={onChangeMinutes} />
            </div>
        </>
    )
}
