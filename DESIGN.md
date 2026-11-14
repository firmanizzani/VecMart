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

The login uses a pale-blue left panel and Public Sans. The dark-blue statement sits above an unframed illustration, without a feature row or extra illustration container. This quiet left composition is the user's preferred direction. The custom raster illustration shows an Indonesian minimarket checkout, with a cashier, POS terminal, scanner, receipt printer and stocked shelves. Grocery packaging adds warm accents. The right side uses an unframed form, up to 400px wide, directly on the pale neutral-blue surface. A two-line welcome heading leads to 52px white email and PIN fields and a centered blue Masuk button. The account-role note has no divider, and the footer keeps only the copyright; authentication behavior remains unchanged. On phones the decorative panel is hidden to prioritize signing in. The copyright footer, including “All rights reserved.”, remains visible at every screen size.

The built-in ImageGen tool generated `static/login-minimarket.png`. Generation prompt: “A polished editorial illustration for VecMart: a friendly cashier behind a cobalt blue minimarket counter, POS touchscreen, barcode scanner, receipt printer, grocery bag and organized shelves. Flat gouache style, restrained texture, dominant #1764bf and #203c5c, powder blue highlights, sparing warm yellow and coral. Compact horizontal composition, transparent background, no text or logos.”

## Public landing

The root route is a public introduction to VecMart rather than an automatic login redirect. It uses the existing Public Sans, blue identity, screenshots of the actual admin dashboard and assistant populated with browser-only sample data, and three bundled product photographs. The hero shows a metal laptop with a 16:10 dashboard screen and a slim phone with separate status bar, Dynamic Island-style cutout, and home indicator. The phone chat uses its own mobile viewport rather than shrinking a desktop screen. A pale blue-to-white gradient hero with dark-blue text, cobalt actions, and soft blue light behind the devices meets a pale-blue band, followed by a three-command interactive AI example on a deep-blue gradient field with a light chat panel, the cashier/stock/report preview, the open/sell/close workflow, FAQ, and a login action. The hero is compact enough to show the pale-blue daily-workflow strip on typical desktop heights. Device mockups are reduced slightly, and the visible device caption and explanatory demo disclaimer are removed per the user request. Gradients and soft lighting are explicitly part of the approved direction. Preview values are fixed illustrative data; the landing does not query store records or Gemini. The closing login action sits in an inset rounded navy-to-cobalt gradient panel rather than a full-width blue band. The hero action is Coba demo Asisten AI and scrolls to the local demo, with Lihat fitur lainnya as its secondary link. Login actions stay in the navbar and closing panel. The title stays VecMart. Logged-in users get a direct application link; protected admin and cashier routes retain the login guard.

The navigation is a compact floating box with rounded corners, inset from the top and both sides. It blends into the light hero at the top. Its links follow the content order: Beranda, Asisten AI, Fitur, Cara kerja, FAQ. Beranda returns to the top without reloading. After 24px of scrolling only that box becomes white with blue branding and a blue login button; it returns to the initial appearance at the top. Section anchors account for its height. Entrances are staggered; device mockups drift slightly; feature switching, example AI replies, chart bars, and buttons have targeted feedback. Reduced motion stops travel, and all content is visible without JavaScript. FAQ uses native details controls. The assistant-access link expands its specific FAQ answer and moves focus to it.

## Assistant

The assistant is accessed through a standalone blue-and-white 3D robot at the bottom-right of admin pages. Its hit target stays fixed while its eyes blink and its body moves slightly on a slow cycle. The transparent two-frame raster sprite is stored at `static/assistant-robot-sprite.png`, generated with the built-in ImageGen tool. There is no rectangular launcher container. A label appears on hover or keyboard focus. Reduced-motion settings stop these animations.

The desktop chat is a nonmodal 440px floating panel so the current products or report page remains visible. It opens with a 160ms entrance. On phones it becomes a full-screen dialog with trapped focus, Escape/close support and focus return to the launcher. Messages, product choices and stock results use the same Public Sans, blue palette and readable data styles as the rest of the app. The header shows connection status, application usage and the next reset in WIB. Successful writes show before/after stock and a reversal action. Failure, quota and expired-session states do not pretend an action succeeded.

## Verification

Run `npm run check` and `npm run build`. Browser visual evidence and isolated fixture checks are saved under `.taste-skill/` (local verification files, excluded from Git). Sample preview data belongs only to that verification browser and is never shipped as application data.

## Responsive validation

The landing FAQ contains five questions, with larger 20px desktop / 18px phone summaries and top spacing matching adjacent sections (120px desktop, 85px tablet, 64px phone). The fifth answer explains automatic stock deduction after a saved checkout.

Mobile controls use at least 44px targets, and primary phone form fields use 16px text. Admin navigation locks background scrolling, traps focus, scrolls on short landscape screens, and restores focus to its trigger when closed. Form overlays sit above the assistant launcher; the dedicated assistant route omits the duplicate launcher. Dashboard period filters fit 320px widths. Short-height cashier views let the cart list shrink and checkout scroll so payment remains reachable. Data tables intentionally scroll inside their own containers.

Browser validation covers all 12 page routes at 320x568, 360x740, 390x844, 768x1024, 844x390, and 1440x900, including create dialogs. Separate interaction checks cover navigation, resize, focus, AI composer, local cart updates, and payment dialogs under shortened keyboard-sized viewports. These are browser viewport tests; no physical-device coverage is implied. Payment and shift writes are blocked in the verification browser.

Desktop hero sizing follows viewport width, so toggling the browser bookmark bar does not trigger a compact 800px-height layout. Vertical spacing adapts continuously. Hero plus workflow strip fill at least the first viewport, keeping the dark AI section below the initial fold. The strip is shorter and devices sit slightly lower and larger. Both public report demos share hourly sample revenue/profit data: Rp 186.000 revenue, Rp 38.000 profit, six transactions, and Rp 31.000 average.
