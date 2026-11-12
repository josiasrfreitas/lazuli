// The sidebar width transition lasts 300 ms. Resize charts after it settles
// instead of recalculating axes, labels and SVG paths at every animation frame.
// Initial chart measurement remains immediate in ResponsiveContainer.
export const HOME_CHART_RESIZE_DELAY_MS = 350;
