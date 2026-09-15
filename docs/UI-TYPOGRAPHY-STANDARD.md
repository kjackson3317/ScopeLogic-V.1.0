# ScopeLogic typography and density standard

This is the shared SLC/SLS design requirement for future UI changes. Controls with the same role in the same area must use the same token, regardless of HTML element or destination. Do not size CRM, User Management or Sign Out separately.

| Role | Size |
| --- | --- |
| Page title | 24px |
| Section heading | 16px |
| Body and Internal Matrix input text | 13px |
| Sidebar navigation, links, Sign Out | 12px |
| Quote table text and inputs | 12px |
| Table headers and field labels | 11px |
| Sidebar group heading and secondary metadata | 10px |

Use Arial/Helvetica sans-serif. Body and navigation weight 400; labels 600; headings 700. Quote rows 38px, inputs 30px, checkboxes 16px. Input corners 6px; panel corners 10px. Internal Matrix short text areas start at 58px and remain vertically resizable. Systems use compact wrapping selections, not large cards. Preserve readable description widths and horizontal table scrolling.

RBB system names in Recommended SOW must be bold and underlined, with recommendation text regular weight. Destructive buttons use dark text on pale red; never dark text on dark red.

Implementation: app/workspace-density.css loaded after legacy styles. Validate computed styles on links as well as buttons, at desktop and mobile widths. Check PDF pagination when altering deliverable typography. Shared SLS packages must adopt these same role tokens during consolidation.
