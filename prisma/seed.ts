import { prisma } from "../lib/prisma";

async function main() {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      roundLengthWeeks: 8,
      weekStartsOn: 0,
      timezone: "America/New_York",
    },
  });

  const defaults = [
    { name: "Cardio", sortOrder: 1 },
    { name: "Circuit/Abs", sortOrder: 2 },
    { name: "16:8 Fast", sortOrder: 3 },
    { name: "Meal Plan", sortOrder: 4 },
  ];

  for (const c of defaults) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: { active: true, sortOrder: c.sortOrder },
      create: { name: c.name, sortOrder: c.sortOrder },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
