import { useCallback, useEffect, useRef, useState } from "react"
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday,
    isBefore,
    startOfDay,
    format,
    setMonth,
    setYear,
    getMonth,
    getYear,
} from "date-fns"
import ChevronDown from "../../assets/custom/chevron-down.svg?react"
import styles from "./expiration-calendar.module.css"

type DropdownType = "month" | "year" | null

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

type ExpirationCalendarProps = {
    selected: Date | null
    onSelect: (date: Date) => void
    onClose: () => void
}

export default function ExpirationCalendar({ selected, onSelect, onClose }: ExpirationCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(() => selected || new Date())
    const [openDropdown, setOpenDropdown] = useState<DropdownType>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const today = startOfDay(new Date())

    const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
    const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1))

    const handleDayClick = useCallback((day: Date) => {
        if (isBefore(day, today)) return
        onSelect(day)
        onClose()
    }, [onSelect, onClose, today])

    useEffect(() => {
        if (!openDropdown) return
        const active = dropdownRef.current?.querySelector('[data-active="true"]')
        if (active) active.scrollIntoView({ block: "center" })
    }, [openDropdown])

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    const days: Date[] = []
    let cursor = calendarStart
    while (cursor <= calendarEnd) {
        days.push(cursor)
        cursor = addDays(cursor, 1)
    }

    const years: number[] = []
    const thisYear = getYear(new Date())
    for (let y = thisYear; y <= thisYear + 5; y++) years.push(y)

    return (
        <>
            <div className={styles.calendarOverlay} onClick={onClose} />
            <div ref={wrapperRef} className={styles.calendarWrapper}>

                {openDropdown && <div className={styles.calendarInnerOverlay} />}

                {/* navigation */}
                <div className={styles.nav}>

                    <button type="button" className={styles.navArrow} onClick={goToPrevMonth} aria-label="Previous month">
                        <ChevronDown className={styles.navArrowIcon} style={{ transform: "rotate(90deg)" }} />
                    </button>

                    <div className={styles.navSelectors}>
                        {/* month selector */}
                        <div style={{ position: "relative" }}>
                            <button
                                type="button"
                                className={styles.navSelect}
                                onClick={() => setOpenDropdown(openDropdown === "month" ? null : "month")}
                            >
                                {format(currentMonth, "MMMM")}
                                <ChevronDown className={styles.navSelectIcon} />
                            </button>

                            {openDropdown === "month" && (
                                <>
                                    <div className={styles.dropdownOverlay} onClick={() => setOpenDropdown(null)} />
                                    <div ref={dropdownRef} className={styles.dropdown}>
                                        {MONTH_NAMES.map((name, i) => (
                                            <button
                                                key={name}
                                                type="button"
                                                data-active={i === getMonth(currentMonth)}
                                                className={`${styles.dropdownItem} ${i === getMonth(currentMonth) ? styles.dropdownItemActive : ""}`}
                                                onClick={() => {
                                                    setCurrentMonth(setMonth(currentMonth, i))
                                                    setOpenDropdown(null)
                                                }}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* year selector */}
                        <div style={{ position: "relative" }}>
                            <button
                                type="button"
                                className={styles.navSelect}
                                onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}
                            >
                                {getYear(currentMonth)}
                                <ChevronDown className={styles.navSelectIcon} />
                            </button>

                            {openDropdown === "year" && (
                                <>
                                    <div className={styles.dropdownOverlay} onClick={() => setOpenDropdown(null)} />
                                    <div ref={dropdownRef} className={styles.dropdown}>
                                        {years.map((y) => (
                                            <button
                                                key={y}
                                                type="button"
                                                data-active={y === getYear(currentMonth)}
                                                className={`${styles.dropdownItem} ${y === getYear(currentMonth) ? styles.dropdownItemActive : ""}`}
                                                onClick={() => {
                                                    setCurrentMonth(setYear(currentMonth, y))
                                                    setOpenDropdown(null)
                                                }}
                                            >
                                                {y}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <button type="button" className={styles.navArrow} onClick={goToNextMonth} aria-label="Next month">
                        <ChevronDown className={styles.navArrowIcon} style={{ transform: "rotate(-90deg)" }} />
                    </button>
                </div>

                {/* weekday headers */}
                <div className={styles.weekdays}>
                    {WEEKDAY_LABELS.map((label) => (
                        <div key={label} className={styles.weekday}>{label}</div>
                    ))}
                </div>

                {/* day grid */}
                <div className={styles.days}>
                    {days.map((day) => {
                        const outside = !isSameMonth(day, currentMonth)
                        const isSelected = selected && isSameDay(day, selected)
                        const isPast = isBefore(day, today)
                        const isTodayDate = isToday(day)

                        return (
                            <button
                                key={day.toISOString()}
                                type="button"
                                className={`${styles.day} ${outside ? styles.dayOutside : ""} ${isSelected ? styles.daySelected : ""} ${isTodayDate && !isSelected ? styles.dayToday : ""} ${isPast ? styles.dayDisabled : ""}`}
                                onClick={() => handleDayClick(day)}
                                disabled={isPast}
                            >
                                {day.getDate()}
                            </button>
                        )
                    })}
                </div>
            </div>
        </>
    )
}
