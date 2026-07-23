import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { getActiveScheduleRule } from "@/lib/schedule";
import { IMAGE_TYPES, type ImageRecord, type ImageType } from "@/lib/types";

// Rounding to the minute means at most one config.json write per screen per
// minute, regardless of the TV's 45s poll interval -- plenty of resolution
// for an "is this screen alive" check without hammering the disk.
function currentMinuteISOString(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId } = await params;
  const store = await readStore();
  const screen = store.screens.find((s) => s.id === screenId);

  if (!screen) {
    return NextResponse.json(
      { error: "Screen not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const nowMinute = currentMinuteISOString();
  if (screen.lastSeenAt !== nowMinute) {
    // Re-read under the lock rather than reusing `store` -- another request
    // may have written since this handler's initial read above.
    await withStoreLock(async () => {
      const freshStore = await readStore();
      const freshScreen = freshStore.screens.find((s) => s.id === screenId);
      if (freshScreen && freshScreen.lastSeenAt !== nowMinute) {
        freshScreen.lastSeenAt = nowMinute;
        await writeStore(freshStore);
      }
    });
  }

  const imageById = new Map<string, ImageRecord>(store.images.map((img) => [img.id, img]));
  const imagesByType = {} as Record<ImageType, ImageRecord[]>;
  for (const type of IMAGE_TYPES) {
    imagesByType[type] = screen.imageIdsByType[type]
      .map((id) => imageById.get(id))
      .filter((img): img is ImageRecord => Boolean(img));
  }

  // A schedule rule temporarily behaves like locking the screen to just its
  // one category (optionally just one image), the same way the "Only"
  // checkboxes work -- silencing every other category and, if the rule
  // names a specific image, narrowing that category down to just it.
  let durationSecondsByType = screen.durationSecondsByType;
  const activeRule = getActiveScheduleRule(screen.scheduleRules, new Date());
  if (activeRule) {
    durationSecondsByType = {} as Record<ImageType, number>;
    for (const type of IMAGE_TYPES) {
      durationSecondsByType[type] = type === activeRule.type ? screen.durationSecondsByType[type] || 3600 : 0;
    }
    if (activeRule.imageId) {
      const ruleImage = imageById.get(activeRule.imageId);
      if (ruleImage) imagesByType[activeRule.type] = [ruleImage];
    }
  }

  const override = store.emergencyOverride.active
    ? {
        active: true as const,
        message: store.emergencyOverride.message,
        imageUrl: store.emergencyOverride.imageId
          ? (imageById.get(store.emergencyOverride.imageId)?.url ?? null)
          : null,
      }
    : null;

  return NextResponse.json(
    { screen: { ...screen, durationSecondsByType }, imagesByType, emergencyOverride: override },
    { headers: { "Cache-Control": "no-store" } }
  );
}
