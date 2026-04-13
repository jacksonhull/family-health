"use server";

import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { localToUtc } from "@/src/lib/timezone";
import { processEventDetail, processNewEventFromFile, isTextBasedFile } from "@/src/lib/ai/process";
import type { EventCategory } from "@prisma/client";

/** Read the return path submitted with the form, fallback to /dashboard */
function getBase(formData: FormData) {
  const p = formData.get("returnPath");
  return typeof p === "string" && p ? p : "/dashboard";
}

export async function updateEvent(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId      = formData.get("userId") as string;
  const entryId     = formData.get("entryId") as string;
  const eventId     = formData.get("eventId") as string;
  const title       = (formData.get("title") as string).trim();
  const category    = (formData.get("category") as string) as EventCategory;
  const startRaw    = formData.get("startTime") as string;
  const endRaw      = ((formData.get("endTime") as string) ?? "").trim() || null;
  const summary     = ((formData.get("summary") as string) ?? "").trim() || null;
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const base        = getBase(formData);

  if (!entryId || !eventId || !title || !startRaw)
    redirect(`${base}?memberId=${userId}&error=missing`);

  const member = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = member?.timezone ?? "UTC";

  await db.$transaction([
    db.event.update({
      where: { id: eventId },
      data: { title, summary, description, category },
    }),
    db.timelineEntry.update({
      where: { id: entryId },
      data: {
        startTime: localToUtc(startRaw, tz),
        endTime: endRaw ? localToUtc(endRaw, tz) : null,
      },
    }),
  ]);

  redirect(`${base}?memberId=${userId}&edit=${entryId}&success=updated`);
}

export async function addTextDetail(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId  = formData.get("userId") as string;
  const entryId = formData.get("entryId") as string;
  const eventId = formData.get("eventId") as string;
  const text    = ((formData.get("text") as string) ?? "").trim();
  const base    = getBase(formData);

  if (!text)
    redirect(`${base}?memberId=${userId}&edit=${entryId}&error=empty`);

  const detail = await db.eventDetail.create({
    data: { eventId, sourceType: "text", originalText: text },
  });

  await processEventDetail(detail.id, eventId, text, null, null);
  redirect(`${base}?memberId=${userId}&edit=${entryId}&success=detail`);
}

export async function addFileDetail(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId  = formData.get("userId") as string;
  const entryId = formData.get("entryId") as string;
  const eventId = formData.get("eventId") as string;
  const file    = formData.get("file") as File | null;
  const base    = getBase(formData);

  if (!file || file.size === 0)
    redirect(`${base}?memberId=${userId}&edit=${entryId}&error=nofile`);

  const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
  const eventDir  = path.join(uploadDir, eventId);
  await fs.mkdir(eventDir, { recursive: true });
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${safeName}`;
  const absPath    = path.join(eventDir, uniqueName);
  const relPath    = `${eventId}/${uniqueName}`;
  const buffer     = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);

  const originalText = isTextBasedFile(file.name, file.type)
    ? new TextDecoder().decode(buffer)
    : null;

  const detail = await db.eventDetail.create({
    data: {
      eventId,
      sourceType: "file",
      originalText,
      fileName: file.name,
      filePath: relPath,
      mimeType: file.type || null,
    },
  });

  await processEventDetail(detail.id, eventId, originalText, file.name, file.type || null);
  redirect(`${base}?memberId=${userId}&edit=${entryId}&success=detail`);
}

export async function deleteDetail(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId   = formData.get("userId") as string;
  const entryId  = formData.get("entryId") as string;
  const detailId = formData.get("detailId") as string;
  const filePath = (formData.get("filePath") as string | null) || null;
  const base     = getBase(formData);

  if (filePath) {
    const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
    await fs.unlink(path.join(uploadDir, filePath)).catch(() => {});
  }

  await db.eventDetail.delete({ where: { id: detailId } });
  redirect(`${base}?memberId=${userId}&edit=${entryId}`);
}

export async function deleteEvent(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId  = formData.get("userId") as string;
  const entryId = formData.get("entryId") as string;
  const eventId = formData.get("eventId") as string;
  const base    = getBase(formData);

  const details = await db.eventDetail.findMany({
    where: { eventId },
    select: { filePath: true },
  });
  const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
  await Promise.all(
    details
      .filter((d) => d.filePath)
      .map((d) => fs.unlink(path.join(uploadDir, d.filePath!)).catch(() => {})),
  );

  await db.timelineEntry.delete({ where: { id: entryId } });
  await db.eventDetail.deleteMany({ where: { eventId } });
  await db.event.delete({ where: { id: eventId } });

  redirect(`${base}?memberId=${userId}`);
}

// ── Create actions (always redirect to /dashboard to open edit modal) ──────

export async function uploadAndCreateEvent(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = formData.get("userId") as string;
  const file   = formData.get("file") as File | null;

  if (!file || file.size === 0)
    redirect(`/dashboard?memberId=${userId}&error=nofile`);

  const member = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = member?.timezone ?? "UTC";

  const event = await db.event.create({
    data: { title: "Processing…", category: "OTHER" },
  });
  const entry = await db.timelineEntry.create({
    data: { userId, eventId: event.id, startTime: new Date() },
  });

  const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
  const eventDir  = path.join(uploadDir, event.id);
  await fs.mkdir(eventDir, { recursive: true });
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${safeName}`;
  const absPath    = path.join(eventDir, uniqueName);
  const relPath    = `${event.id}/${uniqueName}`;
  const buffer     = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);

  const originalText = isTextBasedFile(file.name, file.type)
    ? new TextDecoder().decode(buffer)
    : null;

  const detail = await db.eventDetail.create({
    data: {
      eventId: event.id,
      sourceType: "file",
      originalText,
      fileName: file.name,
      filePath: relPath,
      mimeType: file.type || null,
    },
  });

  await processNewEventFromFile(
    detail.id,
    event.id,
    entry.id,
    file.name,
    file.type || null,
    userId,
    tz,
  );

  redirect(`/dashboard?memberId=${userId}&edit=${entry.id}&success=added`);
}

export async function addEventWithFile(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId      = formData.get("userId") as string;
  const title       = (formData.get("title") as string).trim();
  const category    = (formData.get("category") as string) as EventCategory;
  const startRaw    = formData.get("startTime") as string;
  const endRaw      = ((formData.get("endTime") as string) ?? "").trim() || null;
  const summary     = ((formData.get("summary") as string) ?? "").trim() || null;
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const file        = formData.get("file") as File | null;
  const hasFile     = file && file.size > 0;

  if (!userId || !title || !startRaw)
    redirect(`/dashboard?memberId=${userId}&error=missing`);

  const member = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = member?.timezone ?? "UTC";

  const { eventId, entryId } = await db.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: { title, summary, description, category },
    });
    const entry = await tx.timelineEntry.create({
      data: {
        userId,
        eventId: event.id,
        startTime: localToUtc(startRaw, tz),
        endTime: endRaw ? localToUtc(endRaw, tz) : null,
      },
    });
    return { eventId: event.id, entryId: entry.id };
  });

  if (hasFile) {
    const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
    const eventDir  = path.join(uploadDir, eventId);
    await fs.mkdir(eventDir, { recursive: true });
    const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    const absPath    = path.join(eventDir, uniqueName);
    const relPath    = `${eventId}/${uniqueName}`;
    const buffer     = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, buffer);

    const originalText = isTextBasedFile(file.name, file.type)
      ? new TextDecoder().decode(buffer)
      : null;

    const detail = await db.eventDetail.create({
      data: {
        eventId,
        sourceType: "file",
        originalText,
        fileName: file.name,
        filePath: relPath,
        mimeType: file.type || null,
      },
    });

    await processEventDetail(detail.id, eventId, originalText, file.name, file.type || null);
  }

  redirect(`/dashboard?memberId=${userId}&edit=${entryId}&success=added`);
}
