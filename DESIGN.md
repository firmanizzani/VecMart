# VecMart interface

VecMart is an Indonesian minimarket POS for cashiers and store administrators. The interface is used repeatedly throughout a working day; readable prices, a visible checkout total, and predictable controls take precedence over decoration.

## Visual direction

Framed Sheet, adapted to the existing blue identity and the approved Public Sans typography. A light blue navigation frame surrounds a white work surface. This follows the user’s preference for visibly blue surfaces and active states. Product photographs, the sales chart, and operational exceptions carry the visual emphasis.

- Frame: `#eaf3ff`; surface: `#ffffff`; primary ink: `#20262e`; secondary ink: `#5d6978`.
- Brand/action blue: `#1764bf`; light blue surface: `#e8f2ff`.
- Public Sans is self-hosted at weights 400, 500, 600 and 700. Its OFL license is included in `static/fonts`.
- Titles: 22–24px. Body/table content: 13–14px. Secondary text: 12px. Money uses tabular figures.
- Outer work surface: 16px radius. Inner data surfaces: 12px. Controls: 6–8px.
- Borders separate data; shadows are reserved for dialogs. Status text accompanies status colours.

## Admin

Navigation groups: Penjualan, Inventori, Pelanggan, with account management below. The labelled sidebar folds into a menu below 1100px. Escape closes the menu. A skip link leads to the work area.

The overview leads with revenue, profit, transaction count, and average purchase, followed by a two-series bar chart, best sellers, and stock requiring attention. Revenue uses brand blue; profit uses a neutral comparison colour. Metrics continue to use existing API data.

List screens share search, counts, table typography, empty states, and loading/retry notices. Tables scroll inside their own frames on small screens so all fields remain available. Product identity gets enough space for a thumbnail and readable name. Forms use explicit input labels.

## Cashier

Desktop uses two independently scrolling lanes: product catalogue and a 360px transaction panel. Product photographs use contain scaling. Missing or broken photographs show a package symbol. Existing local `/assets/...` image references resolve through Vite; uploaded/remote product URLs remain supported.

Search and barcode inputs have separate keyboard shortcuts: F2 and F4. F8 opens payment when there is a cart and no blocking dialog. Existing shift checks, member points, promos, held carts, payment and receipt flows remain connected.

Below 768px, a fixed total opens the full cart. Product categories scroll within their row. The cart's close button returns to the catalogue. Hold transactions use a labelled dialog instead of a browser prompt.

Dialogs trap focus, close with Escape where a close action exists, restore focus, and keep long content scrollable. Motion is limited to control feedback and functional loading indicators, with reduced-motion support.

## Login illustration

The login uses a pale-blue left panel and Public Sans. The dark-blue statement sits above an unframed illustration, without a feature row or extra illustration container. This quiet left composition is the user's preferred direction. The custom raster illustration shows an Indonesian minimarket checkout, with a cashier, POS terminal, scanner, receipt printer and stocked shelves. Grocery packaging adds warm accents. The right side has a bordered white form card on a pale neutral-blue surface, with a divided account-role note; authentication behavior remains unchanged. On phones the decorative panel is hidden to prioritize signing in. The copyright footer, including “All rights reserved.”, remains visible at every screen size.

The built-in ImageGen tool generated `static/login-minimarket.png`. Generation prompt: “A polished editorial illustration for VecMart: a friendly cashier behind a cobalt blue minimarket counter, POS touchscreen, barcode scanner, receipt printer, grocery bag and organized shelves. Flat gouache style, restrained texture, dominant #1764bf and #203c5c, powder blue highlights, sparing warm yellow and coral. Compact horizontal composition, transparent background, no text or logos.”

## Verification

Run `npm run check` and `npm run build`. Browser visual evidence and isolated fixture checks are saved under `.taste-skill/` (local verification files, excluded from Git). Sample preview data belongs only to that verification browser and is never shipped as application data.
