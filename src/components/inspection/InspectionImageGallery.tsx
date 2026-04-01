import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ImageOff, Loader2 } from "lucide-react";

interface InspectionImageGalleryProps {
  imageRefs: string[];
  className?: string;
  imageClassName?: string;
}

const STORAGE_PATH_MARKERS = [
  "/storage/v1/object/sign/inspection-images/",
  "/storage/v1/object/public/inspection-images/",
  "/storage/v1/render/image/public/inspection-images/",
] as const;

const getStoragePathFromReference = (reference: string) => {
  if (!reference) return null;
  if (!reference.startsWith("http")) return reference;

  try {
    const { pathname } = new URL(reference);
    const marker = STORAGE_PATH_MARKERS.find((segment) => pathname.includes(segment));

    if (!marker) return null;

    const [, path = ""] = pathname.split(marker);
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

const resolveInspectionImageUrl = async (reference: string) => {
  const storagePath = getStoragePathFromReference(reference);

  if (!storagePath) {
    return reference.startsWith("http") ? reference : null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("get-signed-url", {
      body: { bucket: "inspection-images", path: storagePath },
    });

    if (!error && data?.signedUrl) {
      return data.signedUrl as string;
    }
  } catch {
    // Fall through to client-side fallback.
  }

  try {
    const { data, error } = await supabase.storage
      .from("inspection-images")
      .createSignedUrl(storagePath, 3600);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch {
    // Ignore fallback errors.
  }

  return null;
};

export function InspectionImageGallery({
  imageRefs,
  className,
  imageClassName,
}: InspectionImageGalleryProps) {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const uniqueRefs = Array.from(new Set(imageRefs.filter(Boolean)));

    if (uniqueRefs.length === 0) {
      setResolvedUrls({});
      setLoading(false);
      return () => {
        isActive = false;
      };
    }

    const loadUrls = async () => {
      setLoading(true);

      const entries = await Promise.all(
        uniqueRefs.map(async (reference) => {
          const resolvedUrl = await resolveInspectionImageUrl(reference);
          return [reference, resolvedUrl] as const;
        })
      );

      if (!isActive) return;

      setResolvedUrls(Object.fromEntries(entries));
      setLoading(false);
    };

    void loadUrls();

    return () => {
      isActive = false;
    };
  }, [imageRefs]);

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {imageRefs.map((reference, index) => {
          const resolvedUrl = resolvedUrls[reference];
          const key = `${reference}-${index}`;

          if (!resolvedUrl) {
            return (
              <div
                key={key}
                className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted text-muted-foreground"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageOff className="h-4 w-4" />
                )}
              </div>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => setPreviewUrl(resolvedUrl)}
              className="overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label={`Avaa kuva ${index + 1}`}
            >
              <img
                src={resolvedUrl}
                alt={`Kuva ${index + 1}`}
                className={cn(
                  "h-20 w-20 rounded-md border object-cover transition-opacity hover:opacity-80",
                  imageClassName
                )}
              />
            </button>
          );
        })}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-4xl border bg-background p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Tarkastuskuva</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Tarkastuskuva"
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
