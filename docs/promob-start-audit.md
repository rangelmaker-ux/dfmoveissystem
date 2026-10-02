# Promob Start: hierarchy and shared price catalogue

The inspected export uses LISTING_STRUCTURED_W_OP (exploded listing). It has 372 nodes, 38 top-level instances and 17 distinct top-level groups when identical reference, dimensions, finish, category and environment are combined. The three identical 3604.98.67.56.100 cabinets become one displayed group with quantity three. The attached Promob PDF has 69 grouped listing rows, including internal parts; its row count is not the number of top-level furniture groups. Neither source includes prices.

The shared catalogue record existed with empty materials and catalogue objects, revision zero. The interface substituted code defaults and treated them as already synchronized, so the displayed base had never been stored. The empty shared record was initialized with the existing reference prices and the corrected aliases, guarded by revision zero and empty contents. No existing operator price was replaced. Legacy product and sheet tables were also empty.

MDF.COR.15.100, MDF.COR.18.100 and MDF.COR.6.100 resolve to the existing White TX material prices. The incorrect straight-hinge alias was removed from the curved-hinge product. The actual remaining missing references were added with zero pending prices; a 1mm tape never inherits the 0.45mm tape price. Unsupported 18.5mm board is not silently priced as 18mm.

Exact shop codes and aliases precede generic brand/color recognition. Conflicting aliases and equally scored lines with different prices require manual association. Saved null prices, custom brands, line names and explicit color lists survive catalogue loading. The interface shows the shared source and the resolved material code; an unspecified brand is not invented.

XML items retain actual parent IDs and source descriptions. Pricing aggregates recursively; totals sum roots once. An explicitly priced whole assembly replaces its component total instead of charging both. Linked material prices refresh from the shared catalogue. Screen groups start collapsed, and the internal PDF prints grouped roots with the same total. Technical components remain available for inspection.

The existing 372-item workspace was upgraded only after checking every reference against the supplied source and guarding its revision. Manual/unlinked prices were preserved. The actual Supabase workspace and catalogue were loaded into the updated calculator: 17 groups, correct cabinet repetition, finite amounts, grouped sum equal to calculated total. Fourteen distinct references remain pending real shop prices. This is not a verified final quotation until those prices are supplied.

Verification: 73 tests, TypeScript, lint (existing warnings only), production build, and direct database queries. No authenticated browser session was available for visual verification.
