import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultTrackerType = await prisma.trackerType.upsert({
    where: { name: "Default" },
    update: { active: true },
    create: { name: "Default", active: true },
    select: { id: true },
  });

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

  for (const category of defaults) {
    await prisma.category.upsert({
      where: {
        trackerTypeId_name: {
          trackerTypeId: defaultTrackerType.id,
          name: category.name,
        },
      },
      update: { active: true, sortOrder: category.sortOrder },
      create: {
        trackerTypeId: defaultTrackerType.id,
        name: category.name,
        sortOrder: category.sortOrder,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
