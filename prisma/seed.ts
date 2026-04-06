import { PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const envSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
});

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error(
      "Missing required environment variables: ADMIN_EMAIL (must be a valid email) and ADMIN_PASSWORD must be set."
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
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        role: Role.ADMINISTRATOR,
        passwordHash,
      },
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
