# Prompt: Update the Existing Sikad Icon SVG to an S-Shaped Journey

You are working inside an existing project folder. Update the project's **existing SVG route icon** so its path resembles the supplied generated reference image: a smooth, winding **S-shaped route** with a circular marker at each end. This is an edit to an existing branded project asset, not a request to create a new raster image or redesign the product's visual identity.

## 1. Inspect the Project Before Editing

1. Find and read `design.md` first. Treat it as the source of truth for the project's brand identity, color palette, design tokens, visual style, and icon conventions.
2. Find the existing route icon SVG that matches the provided original image. Inspect the SVG's current paths, circles, `viewBox`, dimensions, fills, strokes, and any relevant SVG definitions before making changes.
3. Check how the SVG is referenced by the application so the existing filename, path, and imports/usages can remain unchanged.
4. Use the generated S-shaped route image supplied with this task as a **shape and composition reference only**. Do not copy its colors over the project's established palette if they differ from `design.md` or the original SVG.

## 2. Required Shape Changes

- Modify the **existing SVG file in place**. Do not replace it with a PNG, JPEG, generated bitmap, or embedded raster image.
- Reshape the route into a smooth, clearly recognizable **S curve**, flowing diagonally from the lower-left toward the upper-right, similar to the supplied generated reference image.
- Give the path two clear circular endpoints: one at the lower-left start and one at the upper-right destination.
- Make the route flow naturally into both endpoint markers. Use smooth Bézier curves and rounded joins/caps where appropriate; avoid sharp corners or awkward kinks.
- Keep the two endpoint markers visually consistent with the project's original marker design. Unless the existing brand system indicates otherwise, make them equal in size and style.
- Keep the route and markers well-composed within the existing SVG canvas, with balanced spacing and enough padding to prevent clipping.

## 3. Preserve Branding and Existing Design Rules

- **Retain the project's original colors and branding.** Use the exact color values already defined in `design.md` and/or the existing SVG. Do not introduce a new palette.
- Preserve the current visual language, including the original icon's line weight, marker treatment, simplicity, and overall personality, adapting only what is necessary to achieve the new S-shaped route.
- Preserve the SVG's existing `viewBox`, dimensions, background/transparent-background behavior, and other structural conventions unless a small change is genuinely required for the new shape to fit correctly.
- If `design.md` defines reusable CSS variables, design tokens, or color names, follow those conventions rather than hardcoding unrelated colors.
- Do not add typography, arrows, road markings, map details, extra dots, shadows, gradients, textures, or decorative elements unless they already exist in the brand system and are essential to the original icon.

## 4. Implementation Constraints

- Edit only the relevant existing SVG, plus a directly necessary supporting file if the SVG cannot be updated correctly without it. Do not modify unrelated components, layouts, styles, dependencies, or configuration.
- Keep the icon as clean, editable vector geometry. Prefer updating the current SVG paths and circles instead of rebuilding the entire asset unnecessarily.
- Preserve meaningful element IDs, classes, accessibility attributes, and references where practical. Do not break existing imports or usage.
- Do not alter `design.md`; use it as guidance, not as a file to rewrite.
- Do not stop to ask questions. Make reasonable decisions based on the current SVG, `design.md`, the supplied reference image, and the project's existing conventions.

## 5. Validation

After editing:

1. Confirm the original SVG file was updated and remains valid SVG markup.
2. Check that the route reads clearly as an S and connects cleanly to both circular endpoints.
3. Verify the colors match the existing design system and branding rather than the generated reference image's colors by default.
4. Confirm the SVG retains its expected size/aspect ratio, has no clipped geometry, and is still used by the same application references.
5. If the project has an available preview or build process, use it to visually inspect the result and run only relevant checks. Fix any issues caused by the change.

## Expected Result

The existing branded SVG icon should visually resemble the supplied generated reference image in **shape and composition**: a thick, smooth S-shaped route connecting two circular endpoint markers from lower-left to upper-right. Its **actual colors, branding, and visual styling must continue to follow the original project and `design.md`**. The result must remain a native SVG in the original project location, with no unrelated changes.