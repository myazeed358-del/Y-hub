# Y-hub component inventory

Source: `artifacts/y-hub/src/App.tsx` and
`artifacts/y-hub/src/index.css`.

The existing application is a source-backed Arabic-first learning dashboard.
The inventory below separates product-specific reusable visual families from
page-level compositions.

| Family | Reference | Evidence | Chunk | Status |
| --- | --- | --- | --- | --- |
| Learning kicker | `components/learning-kicker.md` | `SectionKicker` is reused for lesson hierarchy and dashboard sections. | Pilot | implemented |
| Progress ring | `components/progress-ring.md` | `ProgressRing` provides circular lesson completion feedback. | Pilot | implemented |
| Membership curve | `components/membership-curve.md` | `MiniCurve` visualizes triangular, trapezoidal, and Gaussian membership shapes. | Pilot | implemented |
| Lesson card | `components/lesson-card.md` | Home and course-plan lesson rows combine progress, title, subtitle, and metadata. | Pilot | implemented |
| Learning sidebar | `components/learning-sidebar.md` | `Shell` owns persistent course navigation, active state, and dark navy surface. | Pilot | implemented |

## Chunk plan

The first pilot contains all five source-backed learning families because they
define the product's distinctive language and are independent of one another.
The scaffolded generic primitives remain available for application consumers:
buttons, cards, badges, inputs, feedback, overlays, and navigation primitives.
Those families are stock behavior primitives themed by the extracted tokens,
while the five pilot families carry the academy-specific composition rules.