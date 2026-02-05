import { useState, useCallback, useRef, useEffect } from 'react';

interface VirtualGridState {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

interface UseVirtualGridOptions {
  totalRows: number;
  totalCols: number;
  rowHeight: number;
  colWidth: number;
  rowBuffer?: number;
  colBuffer?: number;
}

interface UseVirtualGridReturn {
  virtualState: VirtualGridState;
  containerRef: React.RefObject<HTMLDivElement>;
  totalHeight: number;
  totalWidth: number;
  handleScroll: () => void;
}

/**
 * Hook for virtual grid scrolling
 * Only renders visible rows/columns plus a buffer
 */
export function useVirtualGrid({
  totalRows,
  totalCols,
  rowHeight,
  colWidth,
  rowBuffer = 10,
  colBuffer = 5,
}: UseVirtualGridOptions): UseVirtualGridReturn {
  const containerRef = useRef<HTMLDivElement>(null);

  const [virtualState, setVirtualState] = useState<VirtualGridState>({
    startRow: 0,
    endRow: Math.min(50, totalRows),
    startCol: 0,
    endCol: Math.min(50, totalCols),
  });

  const totalHeight = totalRows * rowHeight + 11; // Add padding
  const totalWidth = totalCols * colWidth + 13; // Add padding

  const updateVirtualState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const viewportHeight = container.clientHeight;
    const viewportWidth = container.clientWidth;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    const newStartRow = Math.max(0, Math.floor(scrollTop / rowHeight) - rowBuffer);
    const newEndRow = Math.min(
      totalRows,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + rowBuffer
    );

    const newStartCol = Math.max(0, Math.floor(scrollLeft / colWidth) - colBuffer);
    const newEndCol = Math.min(
      totalCols,
      Math.ceil((scrollLeft + viewportWidth) / colWidth) + colBuffer
    );

    setVirtualState((prev) => {
      if (
        prev.startRow === newStartRow &&
        prev.endRow === newEndRow &&
        prev.startCol === newStartCol &&
        prev.endCol === newEndCol
      ) {
        return prev;
      }
      return {
        startRow: newStartRow,
        endRow: newEndRow,
        startCol: newStartCol,
        endCol: newEndCol,
      };
    });
  }, [totalRows, totalCols, rowHeight, colWidth, rowBuffer, colBuffer]);

  // Initial calculation
  useEffect(() => {
    updateVirtualState();
  }, [updateVirtualState]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => updateVirtualState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateVirtualState]);

  return {
    virtualState,
    containerRef,
    totalHeight,
    totalWidth,
    handleScroll: updateVirtualState,
  };
}
