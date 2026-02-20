export type HelpSection = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const QUICK_START_STEPS: string[] = [
  "Open Admin and create at least one person.",
  "Create tracker types, then add categories under each type.",
  "Open a person page and add/select a tracker.",
  "Start a 4-week or 8-week round and tap wheel cells daily.",
];

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "core-model",
    title: "How The Model Works",
    intro: "The app has four core objects.",
    items: [
      "Person: the individual you track.",
      "Tracker type: reusable template (for example, Default, Kids Fitness, Nutrition).",
      "Tracker: a person-specific tracker that uses one tracker type.",
      "Round: a timeboxed 4-week or 8-week period for one tracker.",
    ],
  },
  {
    id: "tracker-types-categories",
    title: "Tracker Types And Categories",
    intro: "Categories are defined on tracker types, not directly on a person.",
    items: [
      "A category name must be unique within a tracker type.",
      "Max 5 active categories per tracker type.",
      "Days off per week and Treat/Sick enabled states are category-level settings.",
      "Category behavior settings apply globally for that tracker type.",
      "Category display name snapshots on existing rounds can be updated with the apply-to-latest option.",
    ],
  },
  {
    id: "round-wheel-status",
    title: "Round Wheel And Statuses",
    intro: "Each tap cycles a category-day entry through statuses.",
    items: [
      "Default cycle: EMPTY -> HALF -> DONE -> OFF -> TREAT -> SICK -> EMPTY.",
      "If Treat or Sick is disabled for a category, that status is skipped in the cycle.",
      "HALF counts as 0.5 toward weekly completion. DONE counts as 1.0.",
      "OFF, TREAT, and SICK do not increase completion score.",
    ],
  },
  {
    id: "trackers-rounds",
    title: "Trackers And Rounds",
    intro: "One person can have multiple active trackers.",
    items: [
      "Round numbers are scoped by tracker type per person.",
      "Starting a new round creates a fresh round for the selected tracker.",
      "Rounds are historical records; old rounds remain read-only in history.",
      "Removing a tracker archives it from active use while preserving historical rounds.",
    ],
  },
  {
    id: "admin-operations",
    title: "Admin Operations",
    intro: "Admin is the control center for setup and maintenance.",
    items: [
      "People: create, rename, or delete a person.",
      "Tracker types: create, rename, or deactivate a type.",
      "Categories: add, reorder, edit, and delete by selected tracker type.",
      "Rounds: delete incorrect/test rounds if needed.",
      "Settings: configure weight unit (Lbs or Kg).",
    ],
  },
  {
    id: "weights-goals",
    title: "Weights And Goal Weight",
    intro: "Weight tracking is optional and stored by week.",
    items: [
      "One weight entry per week per round.",
      "You can select any date within that week when saving weight.",
      "Goal weight is round-specific and shown on weight charts.",
    ],
  },
];
