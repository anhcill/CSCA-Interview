import { PrismaClient } from "@prisma/client";
import { seedRagKnowledge } from "./rag-rich-seed-data.js";

const prisma = new PrismaClient();

seedRagKnowledge(prisma)
  .then((stats) => {
    console.log(`[rag-seed] schools=${stats.schools} majors=${stats.majors} scholarships=${stats.scholarships}`);
    console.log(`[rag-seed] schoolMajors=${stats.schoolMajors} schoolScholarships=${stats.schoolScholarships}`);
  })
  .catch((error) => {
    console.error("[rag-seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
