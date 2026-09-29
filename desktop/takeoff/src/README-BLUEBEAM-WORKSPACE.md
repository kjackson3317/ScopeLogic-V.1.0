# Takeoff V1 estimator interaction checkpoint

This branch layers a Bluebeam-inspired interaction model over the V1 raw-count foundation.

## Test targets

- Select / Pan / Count are distinct modes.
- Escape always cancels the active drawing operation and returns to Select.
- Delete removes the currently selected count, measurement, markup, or snippet unless the count is locked.
- Selecting a count opens Count Measurement Properties.
- Count properties include subject, label, comments, lock, color, opacity, symbol, size/scale, caption, raw custom-count display, Add to Tool Chest, and Set as Default.
- Tool Chest is grouped by low-voltage system.
- The bottom Markups List is visible, collapsible, vertically resizable, searchable, and grouped by tool then sheet.
- Markups List totals are derived from placed raw-count marks. Appearance changes do not change quantity.

The ScopeLogic architecture remains unchanged: one placed count mark equals one raw drawing count. Estimating multipliers, BOM, labor, and pricing stay downstream in ScopeLogic Take Off Rules.
