import { useEffect, useRef, useState, type RefObject } from "react";
type Carousel = {
  rail: RefObject<HTMLUListElement | null>;
  start: boolean;
  end: boolean;
  measure: () => void;
  scroll: (direction: number) => void;
};
export function useHorizontalCarousel(itemCount: number): Carousel {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  function measure(): void {
    const node = rail.current;
    if (node)
      setEdges({
        start: node.scrollLeft <= 1,
        end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 1,
      });
  }
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [itemCount]);
  const scroll = (direction: number): void => {
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth });
  };
  return { rail, ...edges, measure, scroll };
}
