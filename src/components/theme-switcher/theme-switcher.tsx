import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import styles from './theme-switcher.module.css'

import SystemIcon from '../../assets/custom/system.svg?react'
import SunIcon from '../../assets/custom/sun.svg?react'
import MoonIcon from '../../assets/custom/moon.svg?react'

type Theme = "light" | "dark" | "system"

const THEMES: Theme[] = ["system", "light", "dark"]

const ICONS = {
    system: SystemIcon,
    light: SunIcon,
    dark: MoonIcon,
} as const

interface SwitcherIcon {
    type: Theme;
    selectedTheme: Theme;
    setSelectedTheme: Dispatch<SetStateAction<Theme>>;
}

export default function ThemeSwitcher() {
    const [selectedTheme, setSelectedTheme] = useState<Theme>("system");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", selectedTheme)
    }, [selectedTheme])

    return <div
        className={styles.themeSwitcherWrapper}
        role="group"
        aria-label="Theme"
        data-active={selectedTheme}
    >
        <span className={styles.themeSwitcherIndicator} aria-hidden />
        {THEMES.map((theme) => (
            <SwitcherButton
                key={theme}
                type={theme}
                selectedTheme={selectedTheme}
                setSelectedTheme={setSelectedTheme}
            />
        ))}
    </div>
}


function SwitcherButton({ type, selectedTheme, setSelectedTheme }: SwitcherIcon) {
    const isActive = selectedTheme === type
    const Icon = ICONS[type]
    const { trigger: triggerHaptic } = useWebHaptics()

    return <button
        type="button"
        aria-label={`Use ${type} theme`}
        aria-pressed={isActive}
        className={`${styles.switcherButton} ${isActive ? styles.switcherButtonActive : ""}`}
        onClick={() => {
            if (!isActive) triggerHaptic("selection")
            setSelectedTheme(type)
        }}
    >
        <Icon className={styles.switcherButtonIcon} />
    </button>
}
