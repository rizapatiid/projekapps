
"use client";

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageOff, Edit, Trash2 } from "lucide-react";
import { getGoogleDriveImageUrl } from './ReleaseCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface ReleaseDetailData {
  idRilis?: string;
  judulRilisan?: string;
  artis?: string;
  gambarRilisan?: string;
  upcCode?: string;
  isrcCode?: string;
  tanggalTayang?: string;
  status?: string;
  fileAudio?: string;
}

interface ReleaseDetailDialogProps {
  release: ReleaseDetailData | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

const DetailItem = ({ label, value }: { label: string, value?: string | null }) => {
  if (!value && typeof value !== 'string') return null; // Allow empty strings but not null/undefined
  return (
    <div className="mb-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-md">{value || "-"}</p> {/* Display '-' for empty values */}
    </div>
  );
};

export function ReleaseDetailDialog({ release, isOpen, onOpenChange, onEdit, onDelete, disabled }: ReleaseDetailDialogProps) {
  if (!release) return null;

  const imageUrl = getGoogleDriveImageUrl(release.gambarRilisan);
  const placeholderImage = `https://placehold.co/300x300.png`;

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold mb-1">{release.judulRilisan || "Detail Rilisan"}</DialogTitle>
          {release.artis && <DialogDescription className="text-lg text-muted-foreground">{release.artis}</DialogDescription>}
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          <div className="flex justify-center mb-4">
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 rounded-md overflow-hidden bg-muted flex items-center justify-center">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={release.judulRilisan || 'Gambar Rilisan'}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint="album cover detail"
                  onError={(e) => {
                    if ((e.target as HTMLImageElement).src !== placeholderImage) {
                      (e.target as HTMLImageElement).src = placeholderImage;
                    }
                    (e.target as HTMLImageElement).srcset = "";
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-gray-100">
                  <ImageOff size={48} />
                  <span className="text-sm mt-2">No Image</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <DetailItem label="ID Rilis" value={release.idRilis} />
            <DetailItem label="Tanggal Tayang" value={release.tanggalTayang} />
            <DetailItem label="Kode UPC" value={release.upcCode} />
            <DetailItem label="Kode ISRC" value={release.isrcCode} />
            {release.status && (
              <div className="mb-2 sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={getStatusVariant(release.status)} className="text-md px-3 py-1">
                  {release.status}
                </Badge>
              </div>
            )}
            {release.fileAudio && (
                 <div className="mb-2 sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">File Audio</p>
                    <a 
                        href={release.fileAudio} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-md text-primary hover:underline break-all"
                    >
                        {release.fileAudio.startsWith('http') ? new URL(release.fileAudio).pathname.split('/').pop() || release.fileAudio : release.fileAudio}
                    </a>
                </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6 flex-col sm:flex-row sm:justify-between gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={onEdit} disabled={disabled}>
                    <Edit size={16} className="mr-2" />
                    Edit
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={disabled}>
                        <Trash2 size={16} className="mr-2" />
                        Hapus
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                        Tindakan ini tidak dapat dibatalkan. Ini akan menghapus rilisan dari Google Sheet.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                        onClick={onDelete}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                        Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          <DialogClose asChild>
            <Button type="button" variant="outline">Tutup</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
