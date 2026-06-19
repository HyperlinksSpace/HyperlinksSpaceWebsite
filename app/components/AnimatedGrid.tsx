"use client";

import { useEffect, useState, useMemo } from "react";

export default function AnimatedGrid({ children }: { children: React.ReactNode }) {
  const [gridStyle, setGridStyle] = useState<React.CSSProperties>({});
  const [cellOrder, setCellOrder] = useState<number[]>([0, 1, 2, 3]);
  const [animationDurations, setAnimationDurations] = useState<string[]>([
    "3s",
    "3s",
    "3s",
    "3s",
  ]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateCompetitiveProportions = () => {
    const min = 0.2;
    const max = 1.8;
    const val1 = Math.random() * (max - min) + min;
    const val2 = 2 - val1;
    const clampedVal2 = Math.max(min, Math.min(max, val2));
    const clampedVal1 = 2 - clampedVal2;
    return [clampedVal1, clampedVal2];
  };

  useEffect(() => {
    setAnimationDurations(
      [0, 1, 2, 3].map(() => `${2 + Math.random() * 2}s`),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const updateGrid = () => {
      const [col1, col2] = generateCompetitiveProportions();
      const [row1, row2] = generateCompetitiveProportions();
      setGridStyle({
        gridTemplateColumns: `${col1}fr ${col2}fr`,
        gridTemplateRows: `${row1}fr ${row2}fr`,
      });
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.random() * 800 + 400;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        updateGrid();
        scheduleNext();
      }, delay);
    };

    updateGrid();
    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const shufflePositions = () => {
      setCellOrder(shuffleArray([0, 1, 2, 3]));
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.random() * 1500 + 800;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        shufflePositions();
        scheduleNext();
      }, delay);
    };

    timeoutId = setTimeout(() => {
      if (cancelled) return;
      shufflePositions();
      scheduleNext();
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const childrenArray = useMemo(() => {
    return Array.isArray(children) ? children : [children];
  }, [children]);

  const orderedChildren = useMemo(() => {
    return cellOrder
      .map((originalIndex, gridPosition) => {
        const child = childrenArray[originalIndex];
        if (!child) return null;

        const row = Math.floor(gridPosition / 2) + 1;
        const col = (gridPosition % 2) + 1;

        return (
          <div
            key={originalIndex}
            style={{
              gridRow: row,
              gridColumn: col,
              transition:
                "grid-row 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), grid-column 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
              animationName: "cellFight",
              animationDuration: animationDurations[originalIndex],
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDelay: `${originalIndex * 0.2}s`,
            }}
          >
            {child}
          </div>
        );
      })
      .filter(Boolean);
  }, [childrenArray, cellOrder, animationDurations]);

  return (
    <main className="hyperlinksGrid" style={gridStyle}>
      {orderedChildren}
    </main>
  );
}
