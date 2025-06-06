
"use client";

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageOff } from "lucide-react";

interface Release {
  idRilis?: string;
  judulRilisan?: string;
  artis?: string;
  gambarRilisan?: string;
  status?: string;
}

interface ReleaseCardProps {
  release: Release;
  onViewDetails: () => void;
  disabled?: boolean; // Kept for potential future use, but not directly used by edit/delete anymore
}

export const getGoogleDriveImageUrl = (url: string | undefined): string => {
  if (!url || typeof url !== 'string') {
    return "";
  }

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === 'drive.google.com') {
      let fileId: string | null = null;
      if (urlObj.pathname.startsWith('/file/d/')) {
        fileId = urlObj.pathname.split('/')[3];
      } else if (urlObj.searchParams.has('id')) {
        fileId = urlObj.searchParams.get('id');
      }

      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
  } catch (e) {
    // console.warn("Error parsing URL in getGoogleDriveImageUrl:", url, e);
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const lowerUrl = url.toLowerCase();
    if (imageExtensions.some(ext => lowerUrl.endsWith(ext)) || 
        lowerUrl.includes('wp-content/uploads') || 
        lowerUrl.startsWith('https://lh3.googleusercontent.com') ||
        lowerUrl.startsWith('https://placehold.co') ||
        lowerUrl.startsWith('https://spacermp.com')) { // Added spacermp.com
      return url;
    }
  }
  
  return "";
};


export function ReleaseCard({ release, onViewDetails }: ReleaseCardProps) {
  const imageUrl = getGoogleDriveImageUrl(release.gambarRilisan);
  const placeholderImage = `https://placehold.co/96x96.png`;

  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" | "upload" | "rilis" | "pending" => {
    switch (status?.toLowerCase()) {
      case 'upload':
        return 'upload'; // Blue
      case 'rilis':
        return 'rilis'; // Green
      case 'pending':
        return 'pending'; // Orange
      case 'takedown':
        return 'destructive'; // Red
      default:
        return 'outline';
    }
  };

  return (
    <Card 
      className="w-full overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col cursor-pointer"
      onClick={onViewDetails}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onViewDetails()}
      aria-label={`View details for ${release.judulRilisan}`}
    >
      <div className="flex flex-row items-start gap-3 sm:gap-4 p-4 flex-grow">
        <div 
          className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={release.judulRilisan || 'Gambar Rilisan'}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              data-ai-hint="album cover"
              onError={(e) => {
                if ((e.target as HTMLImageElement).src !== placeholderImage) {
                  (e.target as HTMLImageElement).src = placeholderImage;
                }
                (e.target as HTMLImageElement).srcset = "";
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-gray-100">
                <ImageOff size={32} />
                <span className="text-xs mt-1">No Image</span>
            </div>
          )}
        </div>

        <div className="flex-grow min-w-0">
          {release.idRilis && (
            <p className="text-xs text-muted-foreground mb-0.5">ID: {release.idRilis}</p>
          )}
          <h3 className="text-base sm:text-lg font-semibold truncate" title={release.judulRilisan}>
            {release.judulRilisan || "Tanpa Judul"}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground truncate" title={release.artis}>
            {release.artis || "Tanpa Artis"}
          </p>
          {release.status && (
            <Badge variant={getStatusVariant(release.status)} className="mt-2 text-xs">
              {release.status}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
