import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const envSchema = z.object({
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
});

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    console.error(
      "Missing required environment variables: ADMIN_USERNAME and ADMIN_PASSWORD must be set."
    );
    process.exit(1);
  }

  const { ADMIN_USERNAME, ADMIN_PASSWORD } = env.data;
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({
      where: { username: ADMIN_USERNAME },
    });

    if (existing) {
      console.log(`Admin user "${ADMIN_USERNAME}" already exists — skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: { username: ADMIN_USERNAME, passwordHash },
    });

    console.log(`Admin user "${ADMIN_USERNAME}" created successfully.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
