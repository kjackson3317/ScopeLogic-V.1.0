# ScopeLogic UI Interaction Notes

## Outside-click dismissal

- Native browser select menus retain native outside-click behavior.
- ScopeLogic custom multi-select menus close when the user clicks outside the menu.
- Mobile action menus close when the user clicks elsewhere.
- Dismissible dialogs and previews close when the backdrop is clicked or Escape is pressed.
- A future required/blocking dialog that does not expose a Close or Cancel action will not be dismissed by the global outside-click behavior.

## SLR child-record editing

- RFI, Recommend Base Bid, and Contractor Checklist child records are independently collapsible.
- Each section provides Expand All and Collapse All controls.
- Adding a new RFI, RBB, or checklist record opens the new record and collapses the other records of the same type so the new item is immediately in focus.
- Each RFI/RBB/Checklist section exposes a Save SLR button using the same existing submission/save action as the bottom Submit Entry control.
