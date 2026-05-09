import {
    type CSSProperties,
    createContext,
    type KeyboardEvent,
    type ReactNode,
    useCallback,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import styles from "./segmented-control.module.css";

type SegmentedControlContextValue = {
    value: string;
    onValueChange: (value: string) => void;
    register: (value: string, el: HTMLButtonElement | null) => void;
};

const SegmentedControlContext =
    createContext<SegmentedControlContextValue | null>(null);

function useSegmentedControlContext(name: string) {
    const ctx = useContext(SegmentedControlContext);
    if (!ctx)
        throw new Error(`<${name}> must be rendered inside <SegmentedControl>`);
    return ctx;
}

type RootProps<T extends string> = {
    value: T;
    onValueChange: (value: T) => void;
    children: ReactNode;
    className?: string;
    "aria-label"?: string;
    trackColor?: string;
    indicatorColor?: string;
    itemColor?: string;
    activeItemColor?: string;
    /** Outer track corner radius. Default: 8px. */
    wrapperRadius?: string;
    /**
     * Corner radius of the first/last item where they meet the wrapper edge.
     * Visually best when set to `wrapperRadius - 2px` (the 2px is the track's
     * inner padding) so those corners sit concentrically against the wrapper.
     * Default: 6px.
     */
    flatRadius?: string;
    /**
     * Corner radius of every other item corner (between buttons) and of the
     * sliding indicator. Default: 6px.
     */
    innerRadius?: string;
};

function Root<T extends string>({
    value,
    onValueChange,
    children,
    className,
    trackColor,
    indicatorColor,
    itemColor,
    activeItemColor,
    wrapperRadius,
    flatRadius,
    innerRadius,
    ...rest
}: RootProps<T>) {
    const segmentRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef(new Map<string, HTMLButtonElement>());
    const [indicator, setIndicator] = useState<{
        x: number;
        w: number;
        isFirst: boolean;
        isLast: boolean;
    } | null>(null);

    const register = useCallback((v: string, el: HTMLButtonElement | null) => {
        if (el) itemsRef.current.set(v, el);
        else itemsRef.current.delete(v);
    }, []);

    useLayoutEffect(() => {
        const update = () => {
            const segment = segmentRef.current;
            const btn = itemsRef.current.get(value);
            if (!segment || !btn) {
                setIndicator(null);
                return;
            }
            const entries = Array.from(itemsRef.current.entries());
            const activeIdx = entries.findIndex(([v]) => v === value);
            const segRect = segment.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            setIndicator({
                x: btnRect.left - segRect.left,
                w: btnRect.width,
                isFirst: activeIdx === 0,
                isLast: activeIdx === entries.length - 1,
            });
        };

        update();

        const ro = new ResizeObserver(update);
        if (segmentRef.current) ro.observe(segmentRef.current);
        for (const el of itemsRef.current.values()) ro.observe(el);

        return () => ro.disconnect();
    }, [value]);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (
            e.key !== "ArrowRight" &&
            e.key !== "ArrowLeft" &&
            e.key !== "Home" &&
            e.key !== "End"
        )
            return;

        const entries = Array.from(itemsRef.current.entries());
        if (entries.length === 0) return;

        e.preventDefault();
        const currentIdx = entries.findIndex(([v]) => v === value);
        let nextIdx = currentIdx;

        if (e.key === "ArrowRight") nextIdx = (currentIdx + 1) % entries.length;
        else if (e.key === "ArrowLeft")
            nextIdx = (currentIdx - 1 + entries.length) % entries.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = entries.length - 1;

        const [nextValue, nextEl] = entries[nextIdx];
        onValueChange(nextValue as T);
        nextEl.focus();
    };

    return (
        <SegmentedControlContext.Provider
            value={{
                value,
                onValueChange: onValueChange as (v: string) => void,
                register,
            }}
        >
            <div
                ref={segmentRef}
                role="radiogroup"
                onKeyDown={handleKeyDown}
                className={[styles.root, className].filter(Boolean).join(" ")}
                style={
                    {
                        "--segment-track-color": trackColor,
                        "--segment-indicator-color": indicatorColor,
                        "--segment-item-color": itemColor,
                        "--segment-item-active-color": activeItemColor,
                        "--segment-wrapper-radius": wrapperRadius,
                        "--segment-item-flat-radius": flatRadius,
                        "--segment-item-inner-radius": innerRadius,
                    } as CSSProperties
                }
                {...rest}
            >
                {indicator && (
                    <span
                        aria-hidden="true"
                        className={styles.indicator}
                        style={{
                            transform: `translateX(${indicator.x}px)`,
                            width: `${indicator.w}px`,
                            borderTopLeftRadius: indicator.isFirst
                                ? "var(--segment-item-flat-radius)"
                                : "var(--segment-item-inner-radius)",
                            borderBottomLeftRadius: indicator.isFirst
                                ? "var(--segment-item-flat-radius)"
                                : "var(--segment-item-inner-radius)",
                            borderTopRightRadius: indicator.isLast
                                ? "var(--segment-item-flat-radius)"
                                : "var(--segment-item-inner-radius)",
                            borderBottomRightRadius: indicator.isLast
                                ? "var(--segment-item-flat-radius)"
                                : "var(--segment-item-inner-radius)",
                        }}
                    />
                )}
                {children}
            </div>
        </SegmentedControlContext.Provider>
    );
}

type ItemProps = {
    value: string;
    children: ReactNode;
    variant?: "default" | "icon";
    className?: string;
    "aria-label"?: string;
};

function Item({
    value,
    children,
    variant = "default",
    className,
    ...rest
}: ItemProps) {
    const ctx = useSegmentedControlContext("SegmentedControl.Item");
    const ref = useRef<HTMLButtonElement>(null);
    const isActive = ctx.value === value;
    const { register } = ctx;

    useLayoutEffect(() => {
        register(value, ref.current);
        return () => register(value, null);
    }, [register, value]);

    return (
        // biome-ignore lint/a11y/useSemanticElements: items render rich children (icons, labels) that <input type="radio"> cannot host
        <button
            ref={ref}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            data-active={isActive}
            data-variant={variant}
            onClick={() => {
                ctx.onValueChange(value);
            }}
            className={[styles.item, className].filter(Boolean).join(" ")}
            {...rest}
        >
            {children}
        </button>
    );
}

export const SegmentedControl = Object.assign(Root, { Item });
