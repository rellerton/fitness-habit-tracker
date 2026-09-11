# Home Assistant distribution and HACS

Fitness Habit Tracker currently ships as a Home Assistant app (formerly called
an add-on). It is a containerized Next.js service with its own SQLite database
and an ingress web interface.

## How it is installed today

Home Assistant OS and Supervised users add this repository to the Home Assistant
app store, then install Fitness Habit Tracker from that repository. HACS is not
part of this installation path.

HACS does not distribute Home Assistant apps or arbitrary containers. Its
supported package types include custom integrations and dashboard plugins. This
repository therefore should not be submitted to HACS in its current form.

## What a native Home Assistant companion would look like

A future Home Assistant integration can complement the app without replacing
it:

```text
Lovelace / automations
        |
        v
Home Assistant custom integration
        |
        | authenticated, versioned HTTP API
        v
Fitness Habit Tracker app -> Prisma -> SQLite
```

The integration would expose a deliberately small Home Assistant-native surface,
such as current round/week, progress, today's completion state, category
progress, and opt-in weight measurements. Authorized Home Assistant actions
could record a status or weight and start a round.

A dashboard card could be added later for a native round-wheel experience. It
should consume Home Assistant entities and actions rather than query SQLite or a
rotating ingress URL directly.

## Work required before a HACS integration

1. Add authentication to the tracker API and disable unauthenticated direct
   access by default.
2. Define and test a stable, versioned API contract with timeouts, pagination,
   consistent errors, and idempotent write behavior.
3. Strengthen request validation and data invariants, especially dates and the
   relationships among people, trackers, rounds, categories, entries, and
   weights.
4. Create a separate repository with one component under
   `custom_components/fitness_habit_tracker`, plus `manifest.json`, `hacs.json`,
   a UI config flow, translations, diagnostics, tests, and documentation.
5. Pass HACS validation and Hassfest, add Home Assistant Brands assets, and
   publish a full GitHub Release.

The containerized app should continue to use the Home Assistant app repository
and image release workflow. The HACS integration would be an optional bridge for
entities, automations, and actions.
