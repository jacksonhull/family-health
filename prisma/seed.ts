import { PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const envSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
});

const DEFAULT_HISTORY =
  "The patient has no known history of illness or other medical conditions.";

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error(
      "Missing required environment variables: ADMIN_EMAIL (must be a valid email) and ADMIN_PASSWORD must be set.",
    );
    process.exit(1);
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = env.data;
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      console.log(`Admin user "${ADMIN_EMAIL}" already exists — skipping.`);

      // Ensure the admin has at least one MedicalHistory record
      const historyCount = await prisma.medicalHistory.count({
        where: { userId: existing.id },
      });
      if (historyCount === 0) {
        await prisma.medicalHistory.create({
          data: { userId: existing.id, summary: DEFAULT_HISTORY },
        });
        console.log("Created default medical history for existing admin.");
      }
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        role: Role.ADMINISTRATOR,
        passwordHash,
      },
    });

    await prisma.medicalHistory.create({
      data: { userId: admin.id, summary: DEFAULT_HISTORY },
    });

    console.log(`Admin user "${ADMIN_EMAIL}" created successfully.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
