"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageRecord, Screen } from "@/lib/types";
import UploadForm from "./UploadForm";
import ImageLibrary from "./ImageLibrary";
import ScreenCard from "./ScreenCard";
import NewScreenForm from "./NewScreenForm";
import SetupPanel from "./SetupPanel";
import OpenUploadsFolder from "./OpenUploadsFolder";

interface AdminDashboardProps {
  initialImages: ImageRecord[];
  initialScreens: Screen[];
}

export default function AdminDashboard({ initialImages, initialScreens }: AdminDashboardProps) {
  const router = useRouter();
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [screens, setScreens] = useState<Screen[]>(initialScreens);
  const [screensOpen, setScreensOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const reloadImages = useCallback(async () => {
    const res = await fetch("/api/admin/images", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setImages(data.images);
    }
  }, []);

  const reloadScreens = useCallback(async () => {
    const res = await fetch("/api/admin/screens", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setScreens(data.screens);
    }
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col gap-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            TV Signage Admin
          </h1>
          <p className="text-sm text-zinc-500">Upload images, tag them, and assign them to screens.</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Log out
        </button>
      </header>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setScreensOpen((open) => !open)}
          className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Screens ({screens.length})
          </h2>
          <span className="text-sm text-zinc-500">{screensOpen ? "Hide ▲" : "Show ▼"}</span>
        </button>
        <NewScreenForm onCreated={reloadScreens} />
        {screensOpen && (
          <div className="flex flex-col gap-6">
            {screens.length === 0 && (
              <p className="text-sm text-zinc-500">No screens yet. Create one above.</p>
            )}
            {screens.map((screen) => (
              <ScreenCard
                key={screen.id}
                screen={screen}
                images={images}
                onUpdated={reloadScreens}
                onDeleted={reloadScreens}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Add image</h2>
        <UploadForm onUploaded={reloadImages} />
      </section>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setLibraryOpen((open) => !open)}
          className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Image library ({images.length})
          </h2>
          <span className="text-sm text-zinc-500">{libraryOpen ? "Hide ▲" : "Show ▼"}</span>
        </button>
        <OpenUploadsFolder />
        {libraryOpen && (
          <ImageLibrary
            images={images}
            onChanged={() => {
              reloadImages();
              reloadScreens();
            }}
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setSetupOpen((open) => !open)}
          className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Setup</h2>
          <span className="text-sm text-zinc-500">{setupOpen ? "Hide ▲" : "Show ▼"}</span>
        </button>
        {setupOpen && <SetupPanel />}
      </section>
    </div>
  );
}
