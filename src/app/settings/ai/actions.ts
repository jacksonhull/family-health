"use server";

import { auth } from "@/src/auth";
import { redirect } from "next/navigation";
import { db } from "@/src/lib/db";
import {
  testAnthropic,
  testOpenAI,
  testOllama,
  promptAnthropic,
  promptOpenAI,
  promptOllama,
  type TestResult,
} from "@/src/lib/ai/providers";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");
}

export async function testAnthropicAction(): Promise<TestResult> {
  await requireAdmin();
  return testAnthropic();
}

export async function testOpenAIAction(): Promise<TestResult> {
  await requireAdmin();
  return testOpenAI();
}

export async function testOllamaAction(): Promise<TestResult> {
  await requireAdmin();
  return testOllama();
}

export async function promptAnthropicAction(model: string): Promise<TestResult> {
  await requireAdmin();
  return promptAnthropic(model);
}

export async function promptOpenAIAction(model: string): Promise<TestResult> {
  await requireAdmin();
  return promptOpenAI(model);
}

export async function promptOllamaAction(model: string): Promise<TestResult> {
  await requireAdmin();
  return promptOllama(model);
}

export async function saveAISettings(
  defaultProvider: string,
  models: Record<string, string>,
): Promise<void> {
  await requireAdmin();

  const upserts = [
    db.appSetting.upsert({
      where: { key: "ai.defaultProvider" },
      create: { key: "ai.defaultProvider", value: defaultProvider },
      update: { value: defaultProvider },
    }),
    ...Object.entries(models).map(([provider, model]) =>
      db.appSetting.upsert({
        where: { key: `ai.${provider}.model` },
        create: { key: `ai.${provider}.model`, value: model },
        update: { value: model },
      }),
    ),
  ];

  await db.$transaction(upserts);
}
