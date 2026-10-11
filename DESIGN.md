---
name: Budget Lab
description: Clear, task-focused budgeting for a 30-day month.
colors:
  primary: "#17654c"
  ink: "#182c29"
  muted: "#566862"
  page: "#f4f7f6"
  surface: "#ffffff"
  divider: "#d8e3dd"
  error: "#a12832"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: "0.875rem"
    fontWeight: 600
rounded:
  panel: "12px"
  control: "7px"
spacing:
  compact: "8px"
  group: "16px"
  section: "28px"
  desktop-page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
---

# Design System: Budget Lab

## Overview

My Month is a restrained operating workspace that extends the starter's green accent
and light surfaces. Standard form controls and clear currency figures take priority
in this task-focused interface. Sample data and device-local persistence are visibly labelled.

## Colors

The primary green identifies actions, selected categories, and positive allowance.
Ink and muted text provide hierarchy on light page and white surfaces. Health uses
separate green, amber, and red tonal surfaces paired with textual explanations.

## Typography

A system sans stack carries headings, body, labels, and data. Body is 1rem, headings
are 2.25rem, section titles 1.3125rem, and helper/explanation copy .875rem. H1 becomes
1.9rem below 700px. Currency values use tabular numerals. Explanation paragraphs
are constrained to roughly 65–75 characters per line.

## Layout

The page is capped at 1200px, with 32px desktop gutters and 20px mobile gutters.
Desktop separates the inline form and corresponding records. At 1050px the health
summary stacks beneath the cash overview; at 700px the form and records stack.
The forecast table can scroll horizontally while the page stays within the viewport.

## Elevation & Depth

The design uses dividers and tonal surfaces, without shadows. Panels have either
an explicit border or a state-tinted background. There are no decorative overlays.

## Shapes

Panels use 12px corners and controls use 7px corners. Fields use a one-pixel neutral
stroke. Native date pickers and select controls retain their familiar affordances.

## Components

Primary buttons use green with white text, and secondary buttons use a white surface
with a neutral border. Text actions use green; removal uses the error color.
Interactive controls have a three-pixel visible green focus outline with a three-pixel
spacing offset. Hover changes colour over 160ms; reduced-motion preferences remove
transitions. Category navigation uses pressed-state buttons that wrap on narrow screens. Workspace
navigation pairs its selected surface with an underline. Every action and disclosure
has a minimum 44px target; input and select text is 1rem.

Forecast and accounting explanations use native disclosure elements. Empty states
explain the next useful action. Validation errors use an alert and preserve valid data.

## Do's and Don'ts

- Do keep every calculated figure connected to the same engine snapshot.
- Do label sample entries and explain forecast assumptions.
- Do preserve native form affordances, explicit labels, and visible focus.
- Don't use colour alone to communicate month health.
- Clearly report local save status and recovery; temporary previews never persist.

## What If extension

Keep the established tokens and navigation. Use a labelled scenario form alongside
a semantic current/proposed/change table, stacked on narrow screens. Cash, free
cash, daily allowance, and closing forecast are the visible decision impacts.
Supporting reserves, income, savings, and timing remain in a native disclosure.
Proposed amounts carry more weight, and a Preview only label distinguishes the draft.
Mobile rows keep all three figures visible without horizontal table scrolling.
Amount and date fields stack so native dates have enough room at larger text sizes. Health reasons
remain explicit for both states. Disabled Apply prevents committing an absent or
edited preview; feedback explains draft isolation, commits, and Undo boundaries.

## Refinement verification

Preserve the financial engine, reducers, persistence, and sample truth. Use the
incumbent green palette, light surfaces, system sans, familiar controls, dividers,
and panel radii. No decorative assets or new animation are added. Empty feedback
regions collapse; actual feedback remains live. The skip link is concealed with
a clipping pattern and gives keyboard focus to main content when activated.
