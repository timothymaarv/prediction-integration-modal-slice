import { useEffect } from "react";
import { useDialKit } from "dialkit";
import { useGrid } from "./grid-context";
import {
  GRID_STATES,
  GRID_RESEARCH_ONE,
  GRID_RESEARCH_TWO,
  GRID_ASSIGNING,
  columnChase,
  steamAnimation,
  smileAnimation,
  frownAnimation,
  bulbAnimation,
  assigningAnimation,
  cancelledAnimation,
  type GridStateName,
  type GridAnimation,
} from "./grid-states";

/**
 * Repeat animation frames `rounds` times, then hold `revealState` for `holdFrames` frames.
 * Creates a loop: animate → reveal → animate → reveal...
 */
function withReveal(
  anim: GridAnimation,
  revealState: import("./grid").DotState,
  rounds = 2,
  holdFrames = 4,
): GridAnimation {
  const frames = [];
  for (let i = 0; i < rounds; i++) {
    frames.push(...anim.frames);
  }
  for (let i = 0; i < holdFrames; i++) {
    frames.push(revealState);
  }
  return { frames, interval: anim.interval };
}

const stateNames = Object.keys(GRID_STATES) as GridStateName[];

export interface GridStateMeta {
  label: string;
  showChevron: boolean;
}

const STATE_META: Record<GridStateName, GridStateMeta> = {
  default: { label: "", showChevron: false },
  smile: { label: "Thought for 9 seconds", showChevron: true },
  thinking: { label: "Xami is thinking...", showChevron: false },
  "research-1": { label: "Xami is researching...", showChevron: false },
  "research-2": { label: "Xami is researching...", showChevron: false },
  cooking: { label: "Xami is cooking...", showChevron: false },
  assigning: { label: "Assigning models to this task", showChevron: false },
  frown: { label: "Process failed", showChevron: false },
  cancelled: { label: "Process cancelled", showChevron: false },
};

export function getStateMeta(name: GridStateName): GridStateMeta {
  return STATE_META[name];
}

interface SweepFolder {
  pulseColor: string;
  trailColor: string;
  bgColor: string;
  interval: number;
  trailLength: number;
}

interface SmileFolder {
  pulseColor: string;
  trailColor: string;
  bgColor: string;
  dimColor: string;
  interval: number;
  trailLength: number;
}

interface SteamFolder {
  brightColor: string;
  medColor: string;
  dimColor: string;
  interval: number;
}

interface BulbFolder {
  glowColor: string;
  dimColor: string;
  rayColor: string;
  bgColor: string;
  interval: number;
}

interface AssigningFolder {
  pulseColor: string;
  trailColor: string;
  dimColor: string;
  bgColor: string;
  interval: number;
  trailLength: number;
}

interface CancelledFolder {
  brightColor: string;
  dimColor: string;
  bgColor: string;
  interval: number;
}

export function useGridDialKit() {
  const { setState, setStateName, playSequence, stopSequence, setSmileConfig } = useGrid();

  const params = useDialKit("Grid", {
    state: {
      type: "select",
      options: stateNames,
      default: "thinking" as GridStateName,
    },
    transitionMs: [400, 50, 1500, 50],

    "research-1": {
      _collapsed: true,
      pulseColor: "#8C4DFF",
      trailColor: "#8C4DFF80",
      bgColor: "#FFFFFF13",
      interval: [150, 50, 1000, 10],
      trailLength: [3, 1, 5, 1],
    },

    "research-2": {
      _collapsed: true,
      pulseColor: "#8C4DFF",
      trailColor: "#8C4DFF80",
      bgColor: "#FFFFFF13",
      interval: [150, 50, 1000, 10],
      trailLength: [3, 1, 5, 1],
    },

    cooking: {
      _collapsed: true,
      brightColor: "#8C4DFF",
      medColor: "#8C4DFF80",
      dimColor: "#8C4DFF30",
      interval: [400, 100, 1500, 50],
    },

    smile: {
      _collapsed: true,
      pulseColor: "#8C4DFF",
      trailColor: "#8C4DFF80",
      dimColor: "#8C4DFF20",
      bgColor: "#FFFFFF13",
      interval: [200, 50, 1000, 10],
      trailLength: [3, 1, 5, 1],
      hitArea: [40, 14, 120, 1],
      debug: false,
    },

    thinking: {
      _collapsed: true,
      glowColor: "#8C4DFF",
      dimColor: "#8C4DFF40",
      rayColor: "#8C4DFF60",
      bgColor: "#FFFFFF13",
      interval: [300, 50, 1500, 25],
    },

    assigning: {
      _collapsed: true,
      pulseColor: "#8C4DFF",
      trailColor: "#8C4DFF80",
      dimColor: "#8C4DFF25",
      bgColor: "#FFFFFF13",
      interval: [250, 50, 1500, 25],
      trailLength: [3, 1, 8, 1],
    },

    cancelled: {
      _collapsed: true,
      brightColor: "#8C4DFF",
      dimColor: "#8C4DFF25",
      bgColor: "#FFFFFF13",
      interval: [350, 100, 1500, 25],
    },
  });

  // Sync smile config to context
  useEffect(() => {
    const s = params.smile as SmileFolder & { hitArea: number; debug: boolean };
    setSmileConfig({ hitArea: s.hitArea, debug: s.debug });
  }, [
    (params.smile as Record<string, unknown>)?.hitArea,
    (params.smile as Record<string, unknown>)?.debug,
    setSmileConfig,
  ]);

  // Apply CSS transition duration
  useEffect(() => {
    const ms = params.transitionMs as number;
    document.documentElement.style.setProperty("--grid-transition-ms", `${ms}ms`);
  }, [params.transitionMs]);

  // Apply state or animation
  useEffect(() => {
    const name = params.state as GridStateName;
    setStateName(name);

    if (name === "research-1") {
      const f = params["research-1"] as SweepFolder;
      const anim = withReveal(columnChase(GRID_RESEARCH_ONE, f), GRID_RESEARCH_ONE);
      playSequence(anim.frames, anim.interval);
    } else if (name === "research-2") {
      const f = params["research-2"] as SweepFolder;
      const anim = withReveal(columnChase(GRID_RESEARCH_TWO, f), GRID_RESEARCH_TWO);
      playSequence(anim.frames, anim.interval);
    } else if (name === "cooking") {
      const f = params.cooking as SteamFolder;
      const anim = steamAnimation(f);
      playSequence(anim.frames, anim.interval);
    } else if (name === "smile") {
      const f = params.smile as SmileFolder;
      const anim = smileAnimation(f);
      playSequence(anim.frames, anim.interval, 2); // play twice then stop
    } else if (name === "frown") {
      const f = params.smile as SmileFolder; // reuse smile params
      const anim = frownAnimation(f);
      playSequence(anim.frames, anim.interval, 2);
    } else if (name === "thinking") {
      const f = params.thinking as BulbFolder;
      const anim = bulbAnimation(f);
      playSequence(anim.frames, anim.interval);
    } else if (name === "assigning") {
      const f = params.assigning as AssigningFolder;
      const anim = withReveal(assigningAnimation(f), GRID_ASSIGNING, 3);
      playSequence(anim.frames, anim.interval);
    } else if (name === "cancelled") {
      const f = params.cancelled as CancelledFolder;
      const anim = cancelledAnimation(f);
      playSequence(anim.frames, anim.interval);
    } else if (name in GRID_STATES) {
      setState(GRID_STATES[name]);
    }

    return () => stopSequence();
  }, [
    params.state,
    // research-1
    (params["research-1"] as Record<string, unknown>)?.pulseColor,
    (params["research-1"] as Record<string, unknown>)?.trailColor,
    (params["research-1"] as Record<string, unknown>)?.bgColor,
    (params["research-1"] as Record<string, unknown>)?.interval,
    (params["research-1"] as Record<string, unknown>)?.trailLength,
    // research-2
    (params["research-2"] as Record<string, unknown>)?.pulseColor,
    (params["research-2"] as Record<string, unknown>)?.trailColor,
    (params["research-2"] as Record<string, unknown>)?.bgColor,
    (params["research-2"] as Record<string, unknown>)?.interval,
    (params["research-2"] as Record<string, unknown>)?.trailLength,
    // cooking
    (params.cooking as Record<string, unknown>)?.brightColor,
    (params.cooking as Record<string, unknown>)?.medColor,
    (params.cooking as Record<string, unknown>)?.dimColor,
    (params.cooking as Record<string, unknown>)?.interval,
    // smile
    (params.smile as Record<string, unknown>)?.pulseColor,
    (params.smile as Record<string, unknown>)?.trailColor,
    (params.smile as Record<string, unknown>)?.dimColor,
    (params.smile as Record<string, unknown>)?.bgColor,
    (params.smile as Record<string, unknown>)?.interval,
    (params.smile as Record<string, unknown>)?.trailLength,
    // thinking
    (params.thinking as Record<string, unknown>)?.glowColor,
    (params.thinking as Record<string, unknown>)?.dimColor,
    (params.thinking as Record<string, unknown>)?.rayColor,
    (params.thinking as Record<string, unknown>)?.bgColor,
    (params.thinking as Record<string, unknown>)?.interval,
    // assigning
    (params.assigning as Record<string, unknown>)?.pulseColor,
    (params.assigning as Record<string, unknown>)?.trailColor,
    (params.assigning as Record<string, unknown>)?.dimColor,
    (params.assigning as Record<string, unknown>)?.bgColor,
    (params.assigning as Record<string, unknown>)?.interval,
    (params.assigning as Record<string, unknown>)?.trailLength,
    // cancelled
    (params.cancelled as Record<string, unknown>)?.brightColor,
    (params.cancelled as Record<string, unknown>)?.dimColor,
    (params.cancelled as Record<string, unknown>)?.bgColor,
    (params.cancelled as Record<string, unknown>)?.interval,
    setState,
    setStateName,
    playSequence,
    stopSequence,
  ]);

  return params;
}
