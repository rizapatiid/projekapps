
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Info, Plus, UploadCloud, Edit, Search, Sun, Moon, Trash2, Settings, Check, FileSpreadsheet, Trash, Wifi, WifiOff } from "lucide-react";
import type { SheetState } from '@/app/actions';
import { batchUpdateSheetDataAction, deleteSheetRowAction, fetchSheetDataAction, uploadFileAction } from '@/app/actions';
import { ReleaseCard } from './ReleaseCard';
import { ReleaseDetailDialog, type ReleaseDetailData } from './ReleaseDetailDialog';
import { GOOGLE_SHEET_NAME, GOOGLE_SPREADSHEET_ID } from '@/config'; 

const ARTWORK_FOLDER_ID = "1tlVD4NrIzjncLQb44F1dl37sRGR4Gyb1DX_lg6UIR-Zpd-uCkR9Btbc7r95l1mm1toelD9G1";
const AUDIO_FOLDER_ID = "1TWFQdR0KgkxSEtBPagwOg6j-0JWD2tNhwl0-FS9noZjcu9Tb68OmlD2gCVoGfYRk7-aGTUad";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const releaseFormSchema = z.object({
  releaseTitle: z.string().min(1, "Judul rilisan diperlukan"),
  artist: z.string().min(1, "Nama artis diperlukan"),
  artworkFile: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files || files.length === 0 || (files.length > 0 && files[0].type.startsWith("image/")), {
      message: "File harus berupa gambar.",
    })
    .transform(val => (val && val.length > 0 ? val[0] : undefined)),
  audioFile: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files || files.length === 0 || (files.length > 0 && files[0].type.startsWith("audio/")), {
      message: "File harus berupa audio.",
    })
    .transform(val => (val && val.length > 0 ? val[0] : undefined)),
  upcCode: z.string().optional(),
  isrcCode: z.string().optional(),
  status: z.string().min(1, "Status diperlukan"),
  existingArtworkUrl: z.string().optional(),
  existingAudioUrl: z.string().optional(),
  idRilis: z.string().optional(), 
  tanggalTayang: z.string().optional(),
});

type ReleaseFormDataRaw = z.infer<typeof releaseFormSchema>;

interface SelectedReleaseDetail {
    data: ReleaseDetailData;
    rowIndex: number;
}

interface SpreadsheetConfig {
  configId: string;
  displayName: string;
  spreadsheetId: string;
  sheetName: string;
  isDeletable?: boolean;
}

interface SheetDataTableProps {
  initialDefaultSpreadsheetId: string;
  initialDefaultSheetName: string;
}

export function SheetDataTable({ initialDefaultSpreadsheetId, initialDefaultSheetName }: SheetDataTableProps) {
  const [data, setData] = useState<SheetState>({ headers: [], rows: [], sheetId: null, currentSpreadsheetId: initialDefaultSpreadsheetId, currentSheetName: initialDefaultSheetName });
  const [editableRows, setEditableRows] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [isAddReleaseDialogOpen, setIsAddReleaseDialogOpen] = useState(false);
  const [isEditReleaseDialogOpen, setIsEditReleaseDialogOpen] = useState(false);
  const [editingReleaseRowIndex, setEditingReleaseRowIndex] = useState<number | null>(null);

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedReleaseForDetail, setSelectedReleaseForDetail] = useState<SelectedReleaseDetail | null>(null);

  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  const { toast } = useToast();

  const [managedSpreadsheets, setManagedSpreadsheets] = useState<SpreadsheetConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string>('default-sheet-1');
  const [isAddSheetDialogOpen, setIsAddSheetDialogOpen] = useState(false);

  const addSheetForm = useForm({
    resolver: zodResolver(z.object({
      displayName: z.string().min(1, "Nama tampilan diperlukan"),
      spreadsheetId: z.string().min(1, "ID Spreadsheet diperlukan"),
      sheetName: z.string().min(1, "Nama Sheet diperlukan"),
    })),
  });

 useEffect(() => {
    const defaultSheetConfig: SpreadsheetConfig = {
      configId: 'default-sheet-1',
      displayName: 'MULTIPLE STUDIOS', 
      spreadsheetId: initialDefaultSpreadsheetId,
      sheetName: initialDefaultSheetName,
      isDeletable: false,
    };
    const iMusicianSheetConfig: SpreadsheetConfig = {
      configId: 'i-musician-sheet',
      displayName: 'I MUSICIAN',
      spreadsheetId: '10acsNREF-eYf2XZ2yfCmO0s4p3g6fobUrLvzJTCg6zE',
      sheetName: 'I MUSICIAN',
      isDeletable: true,
    };

    let configsFromStorage: SpreadsheetConfig[] = [];
    const storedConfigs = localStorage.getItem('managedSpreadsheets');
    if (storedConfigs) {
      try {
        configsFromStorage = JSON.parse(storedConfigs);
        if (!Array.isArray(configsFromStorage)) { 
            configsFromStorage = [];
        }
      } catch (e) {
        console.error("Error parsing managedSpreadsheets from localStorage", e);
        configsFromStorage = [];
      }
    }

    const defaultSheetIndex = configsFromStorage.findIndex(c => c.configId === defaultSheetConfig.configId);
    if (defaultSheetIndex > -1) {
      configsFromStorage[defaultSheetIndex] = {
        ...configsFromStorage[defaultSheetIndex], 
        ...defaultSheetConfig, 
      };
    } else {
      configsFromStorage.unshift(defaultSheetConfig); 
    }

    const iMusicianSheetIndex = configsFromStorage.findIndex(c => c.configId === iMusicianSheetConfig.configId);
    if (iMusicianSheetIndex > -1) {
       configsFromStorage[iMusicianSheetIndex] = {
         ...configsFromStorage[iMusicianSheetIndex],
         ...iMusicianSheetConfig, 
       };
    } else {
      const insertAtIndex = configsFromStorage.findIndex(c => c.configId === defaultSheetConfig.configId) + 1 || 1;
      configsFromStorage.splice(insertAtIndex, 0, iMusicianSheetConfig);
    }
    
    const uniqueConfigs = configsFromStorage.filter((config, index, self) =>
      index === self.findIndex((c) => c.configId === config.configId)
    );

    setManagedSpreadsheets(uniqueConfigs);

    const storedActiveId = localStorage.getItem('activeSpreadsheetConfigId');
    if (storedActiveId && uniqueConfigs.find(c => c.configId === storedActiveId)) {
      setActiveConfigId(storedActiveId);
    } else {
      setActiveConfigId(defaultSheetConfig.configId); 
    }
  }, [initialDefaultSpreadsheetId, initialDefaultSheetName]);


  useEffect(() => {
    if (managedSpreadsheets.length > 0) {
      localStorage.setItem('managedSpreadsheets', JSON.stringify(managedSpreadsheets));
    }
  }, [managedSpreadsheets]);

  useEffect(() => {
    localStorage.setItem('activeSpreadsheetConfigId', activeConfigId);
  }, [activeConfigId]);
  
  const activeConfig = useMemo(() => managedSpreadsheets.find(c => c.configId === activeConfigId) || managedSpreadsheets.find(c => c.configId === 'default-sheet-1') || managedSpreadsheets[0], [managedSpreadsheets, activeConfigId]);


  const releaseForm = useForm<ReleaseFormDataRaw>({
    resolver: zodResolver(releaseFormSchema),
    defaultValues: {
      releaseTitle: "", artist: "", upcCode: "", isrcCode: "", status: "Upload",
      existingArtworkUrl: "", existingAudioUrl: "", idRilis: "", tanggalTayang: "",
    },
  });

  const refreshDataFromSheet = useCallback(async () => {
    if (!navigator.onLine) {
      toast({
        title: "Tidak Ada Koneksi Internet",
        description: "Tidak dapat memuat data. Periksa koneksi internet Anda.",
        variant: "destructive",
        duration: 5000,
      });
      setIsLoading(false);
      return;
    }
    if (!activeConfig || !activeConfig.spreadsheetId || activeConfig.spreadsheetId === "YOUR_SPREADSHEET_ID_HERE" || !activeConfig.sheetName) {
      toast({ title: "Konfigurasi Error", description: "Spreadsheet ID atau Nama Sheet tidak valid atau belum diatur.", variant: "destructive" });
      setData({ headers: ["Please configure Spreadsheet ID and Sheet Name"], rows: [["Select or add a valid spreadsheet configuration."]], sheetId: null, error: "Config required", currentSpreadsheetId: activeConfig?.spreadsheetId, currentSheetName: activeConfig?.sheetName });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const newData = await fetchSheetDataAction(activeConfig.spreadsheetId, activeConfig.sheetName);
    setData(newData);
    setEditableRows(JSON.parse(JSON.stringify(newData.rows))); 
    if (newData.error && !(newData.headers.length === 1 && newData.rows.length === 1 && newData.rows[0][0].startsWith("Permission denied")) && !(newData.headers.length > 0 && newData.headers[0] === "Please configure Spreadsheet ID and Sheet Name") && !(newData.headers.length > 0 && newData.headers[0] === "Configuration Required")) {
      toast({ title: "Error menyegarkan data", description: newData.error, variant: "destructive" });
    }
    setIsLoading(false);
  }, [activeConfig, toast]);

  useEffect(() => {
    if(activeConfig) {
        refreshDataFromSheet();
    }
  }, [activeConfig, refreshDataFromSheet]);


  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
    setCurrentTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      toast({
        title: "Koneksi Internet Pulih",
        description: "Anda kembali online.",
        duration: 3000,
        // @ts-ignore // Allow custom icon
        icon: <Wifi className="h-5 w-5 text-green-500" />, 
      });
      refreshDataFromSheet(); // Optionally refresh data when back online
    };

    const handleOffline = () => {
      toast({
        title: "Koneksi Internet Terputus",
        description: "Beberapa fitur mungkin tidak berfungsi. Periksa koneksi Anda.",
        variant: "destructive",
        duration: 5000,
         // @ts-ignore // Allow custom icon
        icon: <WifiOff className="h-5 w-5 text-red-500" />,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, refreshDataFromSheet]);


  const toggleTheme = () => {
    setCurrentTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  };

  const columnIndices = useMemo(() => {
    if (!data.headers || data.headers.length === 0) return {
        idRilis: -1, judulRilisan: -1, artis: -1, gambarRilisan: -1, status: -1,
        upcCode: -1, isrcCode: -1, fileAudio: -1, tanggalTayang: -1, actualIdRilisColumn: -1
    };
    
    const lowerCaseHeaders = data.headers.map(h => String(h || '').toLowerCase().trim());
    const findIndex = (name: string) => lowerCaseHeaders.indexOf(name.toLowerCase().trim());

    let idRilisHeaderSource = "id rilis"; 
    let artisHeader = "artis";
    let upcCodeHeader = "upc code";
    let isrcCodeHeader = "isrc code";
    let judulRilisanHeader = "judul rilisan";
    let gambarRilisanHeader = "gambar rilisan";
    let fileAudioHeader = "file audio";
    let statusHeader = "status";
    let tanggalTayangHeader = "tanggal tayang";
    
    if (activeConfig?.configId === 'i-musician-sheet') {
      idRilisHeaderSource = "no"; 
      artisHeader = "artist";
      upcCodeHeader = "upc";
      isrcCodeHeader = "isrc";
    }
    
    return {
        idRilis: findIndex(idRilisHeaderSource), 
        judulRilisan: findIndex(judulRilisanHeader),
        artis: findIndex(artisHeader),
        gambarRilisan: findIndex(gambarRilisanHeader),
        fileAudio: findIndex(fileAudioHeader),
        upcCode: findIndex(upcCodeHeader),
        isrcCode: findIndex(isrcCodeHeader),
        status: findIndex(statusHeader),
        tanggalTayang: findIndex(tanggalTayangHeader),
        actualIdRilisColumn: findIndex("id rilis"), 
    };
  }, [data.headers, activeConfig]);


  const processAndSubmitRelease = async (formData: ReleaseFormDataRaw, rowIndexToUpdate?: number) => {
    if (!navigator.onLine) {
      toast({ title: "Tidak Ada Koneksi Internet", description: "Tidak dapat menyimpan data. Periksa koneksi Anda.", variant: "destructive", duration: 5000 });
      setIsSaving(false);
      return;
    }
    if (!activeConfig) {
        toast({ title: "Error", description: "No active spreadsheet configuration.", variant: "destructive" });
        setIsSaving(false);
        return;
    }
    setIsSaving(true);
    let artworkDriveLink = formData.existingArtworkUrl || "";
    let audioDriveLink = formData.existingAudioUrl || "";

    try {
        if (formData.artworkFile) {
            const base64 = await fileToBase64(formData.artworkFile);
            toast({ title: "Mengunggah Gambar...", description: formData.artworkFile.name });
            const uploadResult = await uploadFileAction({
            fileName: formData.artworkFile.name,
            mimeType: formData.artworkFile.type,
            base64Content: base64,
            folderId: ARTWORK_FOLDER_ID 
            });
            if (uploadResult.success && uploadResult.link) {
            artworkDriveLink = uploadResult.link;
            toast({ title: "Gambar Terunggah", description: formData.artworkFile.name });
            } else throw new Error(uploadResult.error || "Gagal mengunggah gambar ke Drive.");
        }

        if (formData.audioFile) {
            const base64 = await fileToBase64(formData.audioFile);
            toast({ title: "Mengunggah Audio...", description: formData.audioFile.name });
            const uploadResult = await uploadFileAction({
            fileName: formData.audioFile.name,
            mimeType: formData.audioFile.type,
            base64Content: base64,
            folderId: AUDIO_FOLDER_ID
            });
            if (uploadResult.success && uploadResult.link) {
            audioDriveLink = uploadResult.link;
            toast({ title: "Audio Terunggah", description: formData.audioFile.name });
            } else throw new Error(uploadResult.error || "Gagal mengunggah audio ke Drive.");
        }
    } catch (uploadError) {
        toast({ title: "Error Unggahan File", description: uploadError instanceof Error ? uploadError.message : "Terjadi kesalahan saat unggah.", variant: "destructive" });
        setIsSaving(false);
        return;
    }
    
    let currentHeadersForWrite: string[];
    if (data.headers.length > 0 && data.headers.every(h => typeof h === 'string' && h.trim() !== '')) {
        currentHeadersForWrite = data.headers;
    } else { 
        if (activeConfig?.configId === 'i-musician-sheet') {
             currentHeadersForWrite = ["No", "ID Rilis", "Judul Rilisan", "Artist", "Gambar Rilisan", "File Audio", "UPC", "ISRC", "Status", "Tanggal Tayang"];
        } else { 
            currentHeadersForWrite = ["ID Rilis", "Judul Rilisan", "Artis", "Gambar Rilisan", "File Audio", "UPC Code", "ISRC Code", "Status", "Tanggal Tayang"];
        }
    }

    const localHeaderMapForWrite: Record<string, number> = {};
    currentHeadersForWrite.forEach((header, index) => {
        localHeaderMapForWrite[String(header || '').toLowerCase().trim()] = index;
    });
    
    const getActualHeaderNameForWrite = (standardAppFieldName: keyof ReleaseFormDataRaw | "iMusicianNoColumnValue"): string => {
      if (standardAppFieldName === "idRilis") return "id rilis"; 

      if (activeConfig?.configId === 'i-musician-sheet') {
          if (standardAppFieldName === "iMusicianNoColumnValue") return "no";
          if (standardAppFieldName === "artist") return "artist";
          if (standardAppFieldName === "upcCode") return "upc";
          if (standardAppFieldName === "isrcCode") return "isrc";
      } else { 
          if (standardAppFieldName === "artist") return "artis";
          if (standardAppFieldName === "upcCode") return "upc code";
          if (standardAppFieldName === "isrcCode") return "isrc code";
      }
      
      switch (standardAppFieldName) {
          case "releaseTitle": return "judul rilisan";
          case "existingArtworkUrl": 
          case "artworkFile": 
              return "gambar rilisan";
          case "existingAudioUrl": 
          case "audioFile": 
              return "file audio";
          case "status": return "status";
          case "tanggalTayang": return "tanggal tayang";
          default:
              const fieldName = standardAppFieldName as string;
              return fieldName.toLowerCase().replace(/([A-Z])/g, ' $1').trim();
      }
    };
        
    const newRowArray = Array(currentHeadersForWrite.length).fill("");
    
    const writeValue = (appFieldName: keyof ReleaseFormDataRaw | "iMusicianNoColumnValue", value: string) => {
        const actualHeader = getActualHeaderNameForWrite(appFieldName);
        const index = localHeaderMapForWrite[actualHeader.toLowerCase().trim()];
        if (index !== -1 && index !== undefined) {
            newRowArray[index] = value;
        } else {
            console.warn(`Header "${actualHeader}" (for app field "${String(appFieldName)}") not found in sheet headers for writing. Value "${value}" not written.`);
        }
    };
    
    writeValue("idRilis", formData.idRilis || ""); 
    
    writeValue("releaseTitle", formData.releaseTitle);
    writeValue("artist", formData.artist);
    writeValue("existingArtworkUrl", artworkDriveLink); 
    writeValue("existingAudioUrl", audioDriveLink);   
    writeValue("upcCode", formData.upcCode || "");
    writeValue("isrcCode", formData.isrcCode || "");
    writeValue("status", formData.status);
    writeValue("tanggalTayang", formData.tanggalTayang || "");

    if (activeConfig?.configId === 'i-musician-sheet') {
        let noValueToWrite: string;
        const noColIdxForRead = columnIndices.idRilis; 
        
        if (rowIndexToUpdate !== undefined && editableRows[rowIndexToUpdate] && noColIdxForRead !== -1 && editableRows[rowIndexToUpdate][noColIdxForRead] !== undefined) {
            noValueToWrite = String(editableRows[rowIndexToUpdate][noColIdxForRead]);
        } else {
            let maxNo = 0;
            if (noColIdxForRead !== -1 && editableRows) {
                editableRows.forEach(row => {
                    const noVal = parseInt(String(row[noColIdxForRead] || "0"), 10);
                    if (!isNaN(noVal)) {
                        maxNo = Math.max(maxNo, noVal);
                    }
                });
            }
            noValueToWrite = String(maxNo + 1);
        }
        writeValue("iMusicianNoColumnValue", noValueToWrite);
    }


    let changesToSave: { range: string; values: string[][] }[] = [];
    let operationType: "add" | "edit" | "add_with_headers" = "edit";

    if (rowIndexToUpdate === undefined) { 
      operationType = data.headers.length === 0 || data.headers.every(h => String(h || '').trim() === '') ? "add_with_headers" : "add";
      if (operationType === "add_with_headers") {
        changesToSave.push({ range: 'A1', values: [currentHeadersForWrite] }); 
        changesToSave.push({ range: `A2`, values: [newRowArray] }); 
      } else {
        const nextSheetRow = (data.rows?.length || 0) + 2; 
        const range = `A${nextSheetRow}`; 
        changesToSave.push({ range, values: [newRowArray] });
      }
    } else { 
      const sheetRowNumber = rowIndexToUpdate + 2; 
      const range = `A${sheetRowNumber}`;
      changesToSave.push({ range, values: [newRowArray] });
    }
    
    const result = await batchUpdateSheetDataAction(activeConfig.spreadsheetId, activeConfig.sheetName, changesToSave);

    if (result.success) {
      if (operationType.startsWith("add")) {
        toast({ title: "Sukses!", description: "Data Sudah Berhasil Ditambahkan dan disimpan ke database kami." });
      } else {
        toast({ title: "Sukses!", description: "Data sudah berhasil diperbarui." });
      }
      await refreshDataFromSheet();
      releaseForm.reset();
      setArtworkPreview(null);
      setAudioFileName(null);
      setIsAddReleaseDialogOpen(false);
      setIsEditReleaseDialogOpen(false);
      setEditingReleaseRowIndex(null);
    } else {
      toast({ title: "Error Menyimpan Otomatis", description: result.error || "Gagal menyimpan data ke Google Sheet.", variant: "destructive" });
    }
    setIsSaving(false);
  };
  
  const handleOpenAddSheetDialog = () => {
    const baseName = "MULTIPLE STUDIOS";
    const existingConfigs = managedSpreadsheets.filter(
      c => c.displayName === baseName || c.displayName.startsWith(`${baseName} `)
    );

    let nextDisplayName = baseName;
    if (existingConfigs.length > 0 && existingConfigs.some(c => c.displayName === baseName)) { 
      let maxNum = 1; 
      existingConfigs.forEach(c => {
        if (c.displayName.startsWith(`${baseName} `)) {
          const numStr = c.displayName.substring(`${baseName} `.length);
          const num = parseInt(numStr, 10);
          if (!isNaN(num)) {
            maxNum = Math.max(maxNum, num);
          }
        }
      });
      nextDisplayName = `${baseName} ${maxNum + 1}`;
    }
    
    addSheetForm.reset({
      displayName: nextDisplayName,
      spreadsheetId: '',
      sheetName: 'Sheet1',
    });
    setIsAddSheetDialogOpen(true);
  };


  const handleAddConfigSubmit = (formData: { displayName: string; spreadsheetId: string; sheetName: string }) => {
    const newConfig: SpreadsheetConfig = {
      ...formData,
      configId: `custom-${Date.now()}`, 
      isDeletable: true,
    };
    setManagedSpreadsheets(prev => [...prev, newConfig]);
    setActiveConfigId(newConfig.configId); 
    addSheetForm.reset();
    setIsAddSheetDialogOpen(false);
    toast({ title: "Sumber Data Ditambahkan", description: `Sumber data "${formData.displayName}" telah ditambahkan.` });
  };

  const handleDeleteConfig = (configIdToDelete: string) => {
    if (managedSpreadsheets.length <= 1) {
      toast({ title: "Tidak Dapat Menghapus", description: "Konfigurasi terakhir tidak dapat dihapus.", variant: "destructive" });
      return;
    }
    const configToDelete = managedSpreadsheets.find(c => c.configId === configIdToDelete);
    if (!configToDelete || !configToDelete.isDeletable) { 
        toast({ title: "Tidak Dapat Menghapus", description: "Konfigurasi default atau yang sudah ditentukan tidak dapat dihapus.", variant: "destructive" });
        return;
    }

    setManagedSpreadsheets(prev => prev.filter(c => c.configId !== configIdToDelete));
    if (activeConfigId === configIdToDelete) {
      setActiveConfigId(managedSpreadsheets.find(c => c.configId === 'default-sheet-1')?.configId || managedSpreadsheets[0]?.configId || '');
    }
    toast({ title: "Sumber Data Dihapus", description: `Sumber data "${configToDelete.displayName}" telah dihapus.` });
  };


  const handleAddReleaseSubmit = (formData: ReleaseFormDataRaw) => {
    processAndSubmitRelease(formData);
  };

  const handleEditReleaseSubmit = (formData: ReleaseFormDataRaw) => {
    if (editingReleaseRowIndex !== null) {
      processAndSubmitRelease(formData, editingReleaseRowIndex);
    }
  };

  const handleEditRelease = (rowIndex: number) => {
    const rowToEdit = editableRows[rowIndex];
    if (!rowToEdit) return;
    
    let idRilisValue = "";
    const actualIdRilisColIdx = columnIndices.actualIdRilisColumn;
    idRilisValue = actualIdRilisColIdx !== -1 ? String(rowToEdit[actualIdRilisColIdx] || "") : "";

    const releaseData: ReleaseFormDataRaw = {
      idRilis: idRilisValue,
      releaseTitle: columnIndices.judulRilisan !== -1 ? String(rowToEdit[columnIndices.judulRilisan] || "") : "",
      artist: columnIndices.artis !== -1 ? String(rowToEdit[columnIndices.artis] || "") : "",
      existingArtworkUrl: columnIndices.gambarRilisan !== -1 ? String(rowToEdit[columnIndices.gambarRilisan] || "") : "",
      existingAudioUrl: columnIndices.fileAudio !== -1 ? String(rowToEdit[columnIndices.fileAudio] || "") : "",
      upcCode: columnIndices.upcCode !== -1 ? String(rowToEdit[columnIndices.upcCode] || "") : "",
      isrcCode: columnIndices.isrcCode !== -1 ? String(rowToEdit[columnIndices.isrcCode] || "") : "",
      status: columnIndices.status !== -1 ? String(rowToEdit[columnIndices.status] || "Upload") : "Upload",
      tanggalTayang: columnIndices.tanggalTayang !== -1 ? String(rowToEdit[columnIndices.tanggalTayang] || "") : "",
    };

    setEditingReleaseRowIndex(rowIndex);
    releaseForm.reset(releaseData);
    setArtworkPreview(releaseData.existingArtworkUrl || null);
    setAudioFileName(releaseData.existingAudioUrl && releaseData.existingAudioUrl.startsWith('http') ? new URL(releaseData.existingAudioUrl).pathname.split('/').pop() || "File Audio Tersimpan" : (releaseData.existingAudioUrl || null));
    setIsEditReleaseDialogOpen(true);
  };
  
  const handleShowDetails = (rowIndex: number) => {
    const row = editableRows[rowIndex];
    if (!row) return;

    let displayIdRilis = "N/A";
    if (activeConfig?.configId === 'i-musician-sheet') {
        const iMusicianSheetActualIdRilisColIdx = columnIndices.actualIdRilisColumn; 
        const noColIdx = columnIndices.idRilis; 

        if (iMusicianSheetActualIdRilisColIdx !== -1 && row[iMusicianSheetActualIdRilisColIdx] && String(row[iMusicianSheetActualIdRilisColIdx]).trim() !== "") {
            displayIdRilis = String(row[iMusicianSheetActualIdRilisColIdx]); 
        } else if (noColIdx !== -1 && row[noColIdx]) {
            displayIdRilis = `No. ${String(row[noColIdx])}`; 
        }
    } else {
        const defaultSheetActualIdRilisColIdx = columnIndices.actualIdRilisColumn;
        if (defaultSheetActualIdRilisColIdx !== -1 && row[defaultSheetActualIdRilisColIdx]) {
            displayIdRilis = String(row[defaultSheetActualIdRilisColIdx]);
        }
    }

    const releaseDetailsData: ReleaseDetailData = {
        idRilis: displayIdRilis,
        judulRilisan: columnIndices.judulRilisan !== -1 ? String(row[columnIndices.judulRilisan] || "N/A") : "N/A",
        artis: columnIndices.artis !== -1 ? String(row[columnIndices.artis] || "N/A") : "N/A",
        gambarRilisan: columnIndices.gambarRilisan !== -1 ? String(row[columnIndices.gambarRilisan] || undefined) : undefined,
        upcCode: columnIndices.upcCode !== -1 ? String(row[columnIndices.upcCode] || "N/A") : "N/A",
        isrcCode: columnIndices.isrcCode !== -1 ? String(row[columnIndices.isrcCode] || "N/A") : "N/A",
        tanggalTayang: columnIndices.tanggalTayang !== -1 ? String(row[columnIndices.tanggalTayang] || "N/A") : "N/A",
        status: columnIndices.status !== -1 ? String(row[columnIndices.status] || "N/A") : "N/A",
        fileAudio: columnIndices.fileAudio !== -1 ? String(row[columnIndices.fileAudio] || undefined) : undefined,
    };
    setSelectedReleaseForDetail({ data: releaseDetailsData, rowIndex });
    setIsDetailDialogOpen(true);
  };

  const handleDeleteRow = async (rowIndexToDelete: number) => {
     if (!navigator.onLine) {
      toast({ title: "Tidak Ada Koneksi Internet", description: "Tidak dapat menghapus data. Periksa koneksi Anda.", variant: "destructive", duration: 5000 });
      setIsSaving(false);
      return;
    }
     if (!activeConfig || data.sheetId === null || data.sheetId === undefined) {
      toast({ title: "Error", description: "Sheet ID tidak valid atau konfigurasi tidak aktif.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    const result = await deleteSheetRowAction(activeConfig.spreadsheetId, data.sheetId, rowIndexToDelete);
    if (result.success) {
      toast({ title: "Sukses!", description: "Data berhasil dihapus dari sistem kami." });
      await refreshDataFromSheet(); 
    } else {
      toast({ title: "Error Menghapus Otomatis", description: result.error || "Gagal menghapus baris.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const generateNewIdRilis = (): string => {
    const idColumnForGeneration = columnIndices.actualIdRilisColumn; 
    let maxNum = 0;

    if (activeConfig?.configId === 'i-musician-sheet') {
      if (idColumnForGeneration !== -1 && editableRows) {
        editableRows.forEach(row => {
          const idVal = String(row[idColumnForGeneration] || "");
          if (idVal.toUpperCase().startsWith("IM-")) {
            const numPart = parseInt(idVal.substring(3), 10);
            if (!isNaN(numPart)) {
              maxNum = Math.max(maxNum, numPart);
            }
          }
        });
      }
      const nextIdNumber = maxNum + 1;
      return `IM-${String(nextIdNumber).padStart(3, '0')}`;
    } else if (activeConfig?.configId === 'default-sheet-1') {
        if (idColumnForGeneration !== -1 && editableRows) {
            editableRows.forEach(row => {
            const idVal = String(row[idColumnForGeneration] || "");
            if (idVal.toUpperCase().startsWith("MS-")) {
                const numPart = parseInt(idVal.substring(3), 10);
                if (!isNaN(numPart)) {
                    maxNum = Math.max(maxNum, numPart);
                }
            }
            });
        }
        const nextIdNumber = maxNum + 1;
        return `MS-${String(nextIdNumber)}`;
    } else { 
      if (idColumnForGeneration !== -1 && editableRows) { 
         editableRows.forEach(row => {
          const idVal = String(row[idColumnForGeneration] || ""); 
          if (idVal.toUpperCase().startsWith("GS-")) { 
            const numPart = parseInt(idVal.substring(3), 10);
            if (!isNaN(numPart)) {
              maxNum = Math.max(maxNum, numPart);
            }
          }
        });
      }
      const nextIdNumber = maxNum + 1;
      return `GS-${String(nextIdNumber).padStart(3, '0')}`;
    }
  };

  const renderFormFields = (isEditMode: boolean) => (
    <>
      <FormField
          control={releaseForm.control}
          name="idRilis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID Rilis</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    activeConfig?.configId === 'i-musician-sheet'
                      ? 'Contoh: IM-001'
                      : activeConfig?.configId === 'default-sheet-1'
                      ? 'Contoh: MS-1'
                      : 'Contoh: GS-001'
                  }
                  {...field}
                  disabled 
                  value={field.value || ''}
                />
              </FormControl>
              {!isEditMode && <FormDescription>ID ini dibuat secara otomatis.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      <FormField
        control={releaseForm.control}
        name="releaseTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Judul Rilisan</FormLabel>
            <FormControl>
              <Input placeholder="Contoh: Album Terbaikku" {...field} disabled={isSaving} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={releaseForm.control}
        name="artist"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{activeConfig?.configId === 'i-musician-sheet' ? 'Artist' : 'Artis'}</FormLabel>
            <FormControl>
              <Input placeholder="Contoh: Nama Artis" {...field} disabled={isSaving} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
       <FormField
        control={releaseForm.control}
        name="tanggalTayang"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tanggal Tayang</FormLabel>
            <FormControl>
              <Input 
                type="text" 
                placeholder="Contoh: 25/12/2024 atau Sesuai Kesepakatan" 
                {...field} 
                disabled={isSaving} 
                value={field.value || ''}
              />
            </FormControl>
            <FormDescription>Masukkan tanggal rilis akan ditayangkan (format bebas).</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={releaseForm.control}
        name="artworkFile"
        render={({ field: { onChange, value, ...restField } }) => (
          <FormItem>
            <FormLabel>Gambar Rilisan {isEditMode && releaseForm.getValues("existingArtworkUrl") && "(Kosongkan jika tidak ingin mengubah)"}</FormLabel>
            <FormControl>
              <Input
                type="file"
                accept="image/*"
                {...restField}
                onChange={(e) => {
                    onChange(e.target.files);
                    if (e.target.files && e.target.files[0]) {
                        const reader = new FileReader();
                        reader.onload = (event) => setArtworkPreview(event.target?.result as string);
                        reader.readAsDataURL(e.target.files[0]);
                    } else if (!isEditMode || !releaseForm.getValues("existingArtworkUrl")) {
                        setArtworkPreview(null);
                    } else {
                        setArtworkPreview(releaseForm.getValues("existingArtworkUrl") || null);
                    }
                }}
                disabled={isSaving}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </FormControl>
            {artworkPreview ? (
                <img src={artworkPreview} alt="Pratinjau Gambar" className="mt-2 h-24 w-24 object-cover rounded" />
            ) : isEditMode && releaseForm.getValues("existingArtworkUrl") && (
                 <a href={releaseForm.getValues("existingArtworkUrl")} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-1 block">Lihat Gambar Saat Ini</a>
            )}
            <FormDescription>Unggah file gambar (jpg, png, dll).</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={releaseForm.control}
        name="audioFile"
        render={({ field: { onChange, value, ...restField } }) => (
          <FormItem>
            <FormLabel>File Audio {isEditMode && releaseForm.getValues("existingAudioUrl") && "(Kosongkan jika tidak ingin mengubah)"}</FormLabel>
            <FormControl>
               <Input
                type="file"
                accept="audio/*"
                {...restField}
                onChange={(e) => {
                    onChange(e.target.files);
                    setAudioFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : (isEditMode && releaseForm.getValues("existingAudioUrl") && (releaseForm.getValues("existingAudioUrl") as string).startsWith('http') ? new URL(releaseForm.getValues("existingAudioUrl") as string).pathname.split('/').pop() || "File Audio Tersimpan" : (releaseForm.getValues("existingAudioUrl") as string || null) ));
                }}
                disabled={isSaving}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
               />
            </FormControl>
            {audioFileName ? (
                <p className="text-sm text-muted-foreground mt-1">File dipilih: {audioFileName}</p>
            ) : isEditMode && releaseForm.getValues("existingAudioUrl") && (
                 <a href={releaseForm.getValues("existingAudioUrl")} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-1 block">Dengarkan Audio Saat Ini</a>
            )}
            <FormDescription>Unggah file audio (mp3, wav, dll).</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={releaseForm.control}
        name="upcCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{activeConfig?.configId === 'i-musician-sheet' ? 'UPC' : 'Kode UPC'}</FormLabel>
            <FormControl>
              <Input placeholder="Contoh: 123456789012" {...field} disabled={isSaving} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={releaseForm.control}
        name="isrcCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{activeConfig?.configId === 'i-musician-sheet' ? 'ISRC' : 'Kode ISRC'}</FormLabel>
            <FormControl>
              <Input placeholder="Contoh: USXYZ1234567" {...field} disabled={isSaving} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={releaseForm.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSaving}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status rilisan" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Upload">Upload</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Rilis">Rilis</SelectItem>
                <SelectItem value="Takedown">Takedown</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );

  const filteredRows = useMemo(() => {
    if (!searchTerm) return editableRows;
    return editableRows.filter(row => {
      const title = columnIndices.judulRilisan !== -1 ? String(row[columnIndices.judulRilisan] || "") : "";
      const artist = columnIndices.artis !== -1 ? String(row[columnIndices.artis] || "") : "";
      return title.toLowerCase().includes(searchTerm.toLowerCase()) ||
             artist.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [editableRows, searchTerm, columnIndices]);


  if (data.error && data.headers.length === 1 && data.rows.length === 1 && String(data.rows[0][0]).includes("Permission denied")) {
     return (
      <div className="container mx-auto p-4">
         <Card className="max-w-lg mx-auto shadow-lg rounded-lg overflow-hidden">
          <CardHeader className="bg-destructive text-destructive-foreground p-4">
            <CardTitle className="flex items-center gap-2 text-lg"><Info size={22} /> Error Konfigurasi</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p>Gagal memuat data karena error perizinan akses Google Sheet.</p>
            <p className="text-sm">Harap pastikan Google Sheet <code className="text-xs bg-muted p-1 rounded">{data.currentSpreadsheetId || 'default'}</code> (sheet: <code className="text-xs bg-muted p-1 rounded">{data.currentSheetName || GOOGLE_SHEET_NAME}</code>) telah dibagikan dengan alamat email akun layanan berikut:</p>
            <p className="font-mono bg-muted p-2 rounded text-xs break-all select-all">{credentials.client_email || "Alamat email service account tidak termuat."}</p>
            <p className="text-sm">Bagikan dengan memberikan izin sebagai "Editor" agar aplikasi dapat membaca dan menulis data.</p>
             <Button onClick={() => refreshDataFromSheet()} className="mt-3 w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Coba Lagi Setelah Memperbaiki Izin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
   if (data.error && data.headers.length > 0 && (String(data.headers[0]) === "Please configure Spreadsheet ID" || String(data.headers[0]) === "Please configure Spreadsheet ID and Sheet Name" || String(data.headers[0]) === "Configuration Required")) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Card className="max-w-md mx-auto shadow-lg rounded-lg">
            <CardHeader className="bg-destructive text-destructive-foreground p-4">
                <CardTitle className="flex items-center justify-center gap-2 text-lg"><Info size={22} /> Konfigurasi Spreadsheet</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
                <p>{String(data.rows[0]?.[0]) || "Silakan pilih atau tambahkan konfigurasi Spreadsheet yang valid melalui menu di header."}</p>
                <p className="text-sm">Pastikan ID dan Nama Sheet Google sudah benar.</p>
                 <Button onClick={() => refreshDataFromSheet()} className="mt-3 w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Coba Lagi Setelah Konfigurasi
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (data.headers.length === 0 && editableRows.length === 0 && !data.error && !isLoading) {
     return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" title="Kelola Sumber Data">
                            <Settings size={18} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Pilih Data</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                        {managedSpreadsheets.map((config) => (
                            <DropdownMenuItem key={config.configId} onClick={() => setActiveConfigId(config.configId)} className="flex justify-between items-center">
                                <span>{config.displayName}</span>
                                <div className="flex items-center">
                                {activeConfigId === config.configId && <Check className="h-4 w-4 text-primary mr-2" />}
                                {config.isDeletable && (
                                    <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-destructive hover:text-destructive/80"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.configId); }}
                                    title={`Hapus konfigurasi ${config.displayName}`}
                                    >
                                    <Trash size={14} />
                                    </Button>
                                )}
                                </div>
                            </DropdownMenuItem>
                        ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleOpenAddSheetDialog}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" /> Tambah Data
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <div className="text-xl sm:text-2xl font-bold text-primary whitespace-nowrap hidden md:block">
                    {activeConfig?.displayName || "MULTIPLE STUDIOS"}
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <div className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari rilisan..."
                  className="pl-10 h-9 sm:h-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoading || isSaving}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" disabled={isLoading || isSaving}>
                {currentTheme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </header>
        <div className="container mx-auto p-4 text-center flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <h3 className="text-xl font-semibold text-muted-foreground mb-3">Sumber Data Kosong atau Tidak Ada Data</h3>
          <p className="text-muted-foreground mb-6 max-w-md">Tidak ada data ditemukan di sumber data "{activeConfig?.displayName || 'yang dipilih'}" atau sheet masih kosong. Tambahkan rilisan pertama Anda untuk memulai.</p>
          <Button
              onClick={() => {
              if (!isSaving) {
                  releaseForm.reset({
                      releaseTitle: "", artist: "", upcCode: "", isrcCode: "", status: "Upload",
                      existingArtworkUrl: "", existingAudioUrl: "", 
                      idRilis: generateNewIdRilis(), 
                      tanggalTayang: "" 
                  });
                  setArtworkPreview(null);
                  setAudioFileName(null);
                  setIsAddReleaseDialogOpen(true);
              }
              }}
              disabled={isLoading || isSaving || !activeConfig}
              title="Tambah Rilisan Baru"
              size="lg"
              className="px-6 py-3 text-base"
          >
              <Plus className="mr-2 h-5 w-5" />
              Tambah Rilisan Pertama
          </Button>
        </div>
        <Dialog open={isAddSheetDialogOpen} onOpenChange={setIsAddSheetDialogOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Sumber Data Baru</DialogTitle>
                <DialogDescription>Masukkan detail untuk sumber data Google Sheet baru yang ingin Anda kelola.</DialogDescription>
            </DialogHeader>
            <FormProvider {...addSheetForm}>
                <form onSubmit={addSheetForm.handleSubmit(handleAddConfigSubmit)} className="space-y-4 py-4">
                <FormField
                    control={addSheetForm.control}
                    name="displayName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nama Tampilan</FormLabel>
                        <FormControl><Input placeholder="Contoh: MULTIPLE STUDIOS 2" {...field} /></FormControl>
                        <FormDescription>Nama yang akan ditampilkan di menu.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={addSheetForm.control}
                    name="spreadsheetId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>ID Spreadsheet</FormLabel>
                        <FormControl><Input placeholder="ID dari URL Google Sheet" {...field} /></FormControl>
                        <FormDescription>Tempel ID unik dari URL Google Sheet Anda.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={addSheetForm.control}
                    name="sheetName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nama Sheet</FormLabel>
                        <FormControl><Input placeholder="Contoh: Sheet1" {...field} /></FormControl>
                         <FormDescription>Nama tab spesifik dalam Spreadsheet Anda (case-sensitive).</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
                    <Button type="submit">Tambah</Button>
                </DialogFooter>
                </form>
            </FormProvider>
            </DialogContent>
        </Dialog>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-4">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" title="Kelola Sumber Data">
                            <Settings size={18} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Pilih Data</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                        {managedSpreadsheets.map((config) => (
                            <DropdownMenuItem key={config.configId} onClick={() => setActiveConfigId(config.configId)} className="flex justify-between items-center pr-2">
                                <span className="flex-grow truncate pr-2">{config.displayName}</span>
                                <div className="flex items-center flex-shrink-0">
                                {activeConfigId === config.configId && <Check className="h-4 w-4 text-primary mr-1" />}
                                {config.isDeletable && (
                                    <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-destructive hover:text-destructive/80"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.configId); }}
                                    title={`Hapus konfigurasi ${config.displayName}`}
                                    >
                                    <Trash size={14} />
                                    </Button>
                                )}
                                </div>
                            </DropdownMenuItem>
                        ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleOpenAddSheetDialog}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" /> Tambah Data
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <div className="text-xl sm:text-2xl font-bold text-primary whitespace-nowrap hidden md:block">
                   {activeConfig?.displayName || "MULTIPLE STUDIOS"}
                </div>
            </div>
          
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <div className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari rilisan..."
                className="pl-10 h-9 sm:h-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || isSaving || !activeConfig}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" disabled={isLoading || isSaving}>
              {currentTheme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-2 sm:p-4 flex-grow">

        {data.error && !isLoading && !String(data.headers[0])?.includes("Please configure") && !String(data.headers[0])?.includes("Configuration Required") && <p className="text-destructive mb-4 text-center">Error saat memuat data terakhir: {data.error}</p>}

        <div className="grid grid-cols-1 gap-4">
          {filteredRows.map((row, rowIndex) => {
              let cardKey: string;
              let displayIdOnCard: string; 

              const idRilisForCardDisplay = columnIndices.idRilis; 
              const actualIdRilisForSystem = columnIndices.actualIdRilisColumn; 

              if (activeConfig?.configId === 'i-musician-sheet') {
                  if (actualIdRilisForSystem !== -1 && row[actualIdRilisForSystem] && String(row[actualIdRilisForSystem]).trim()) {
                      cardKey = String(row[actualIdRilisForSystem]);
                  } else if (idRilisForCardDisplay !== -1 && row[idRilisForCardDisplay]) {
                      cardKey = `no-${String(row[idRilisForCardDisplay])}`;
                  } else {
                      cardKey = `row-${rowIndex}`; 
                  }
                  displayIdOnCard = (idRilisForCardDisplay !== -1 && row[idRilisForCardDisplay]) ? `No. ${String(row[idRilisForCardDisplay])}` : "N/A";
              } else { 
                   cardKey = (actualIdRilisForSystem !== -1 && row[actualIdRilisForSystem]) ? String(row[actualIdRilisForSystem]) : `row-${rowIndex}`;
                   displayIdOnCard = cardKey.startsWith('row-') ? "N/A" : cardKey;
              }
              
              const release = {
                  idRilis: displayIdOnCard, 
                  judulRilisan: columnIndices.judulRilisan !== -1 ? String(row[columnIndices.judulRilisan] || "N/A") : "N/A",
                  artis: columnIndices.artis !== -1 ? String(row[columnIndices.artis] || "N/A") : "N/A",
                  gambarRilisan: columnIndices.gambarRilisan !== -1 ? String(row[columnIndices.gambarRilisan] || undefined) : undefined,
                  status: columnIndices.status !== -1 ? String(row[columnIndices.status] || "N/A") : "N/A",
              };
              
              const originalEditableRowIndex = editableRows.findIndex(er => {
                  let keyToCompare: string;
                  const erIdRilisForCard = columnIndices.idRilis;
                  const erActualIdRilis = columnIndices.actualIdRilisColumn;

                  if (activeConfig?.configId === 'i-musician-sheet') {
                      if (erActualIdRilis !== -1 && er[erActualIdRilis] && String(er[erActualIdRilis]).trim()) {
                          keyToCompare = String(er[erActualIdRilis]);
                      } else if (erIdRilisForCard !== -1 && er[erIdRilisForCard]) {
                          keyToCompare = `no-${String(er[erIdRilisForCard])}`;
                      } else {
                          return false; 
                      }
                  } else {
                      keyToCompare = (erActualIdRilis !== -1 && er[erActualIdRilis]) ? String(er[erActualIdRilis]) : "";
                  }
                  return keyToCompare === cardKey;
              });

              const actualRowIndex = originalEditableRowIndex > -1 ? originalEditableRowIndex : rowIndex;

              return (
                  <ReleaseCard
                      key={`${cardKey}-${activeConfig?.configId || 'default'}-${actualRowIndex}`} 
                      release={release}
                      onViewDetails={() => handleShowDetails(actualRowIndex)}
                      disabled={isLoading || isSaving}
                  />
              );
          })}
        </div>

        {filteredRows.length === 0 && !isLoading && !data.error && searchTerm && (
          <p className="text-center py-10 text-muted-foreground">
            Tidak ada rilisan yang cocok dengan "{searchTerm}".
          </p>
        )}
         {(isLoading || isSaving) && (
          <div className="fixed inset-0 bg-background/80 flex justify-center items-center z-50">
            <div className="flex flex-col items-center bg-card p-6 rounded-lg shadow-xl">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">
                {isSaving ? "Menyimpan data..." : isLoading ? "Memuat data..." : "Memproses..."}
                </p>
            </div>
          </div>
        )}

        <Dialog open={isAddSheetDialogOpen} onOpenChange={setIsAddSheetDialogOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Sumber Data Baru</DialogTitle>
                <DialogDescription>Masukkan detail untuk sumber data Google Sheet baru yang ingin Anda kelola.</DialogDescription>
            </DialogHeader>
            <FormProvider {...addSheetForm}>
                <form onSubmit={addSheetForm.handleSubmit(handleAddConfigSubmit)} className="space-y-4 py-4">
                <FormField
                    control={addSheetForm.control}
                    name="displayName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nama Tampilan</FormLabel>
                        <FormControl><Input placeholder="Contoh: MULTIPLE STUDIOS 2" {...field} /></FormControl>
                        <FormDescription>Nama yang akan ditampilkan di menu.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={addSheetForm.control}
                    name="spreadsheetId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>ID Spreadsheet</FormLabel>
                        <FormControl><Input placeholder="ID dari URL Google Sheet" {...field} /></FormControl>
                        <FormDescription>Tempel ID unik dari URL Google Sheet Anda.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={addSheetForm.control}
                    name="sheetName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nama Sheet</FormLabel>
                        <FormControl><Input placeholder="Contoh: Sheet1" {...field} /></FormControl>
                         <FormDescription>Nama tab spesifik dalam Spreadsheet Anda (case-sensitive).</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
                    <Button type="submit">Tambah</Button>
                </DialogFooter>
                </form>
            </FormProvider>
            </DialogContent>
        </Dialog>


        <Dialog open={isAddReleaseDialogOpen} onOpenChange={(open) => {
          if (!isSaving) {
            setIsAddReleaseDialogOpen(open);
            if (!open) {
              releaseForm.reset();
              setArtworkPreview(null);
              setAudioFileName(null);
            }
          }
        }}>
          <DialogContent className="w-[90vw] max-w-lg sm:max-w-[525px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Tambah Rilisan Baru</DialogTitle>
              <DialogDescription>
                Mohon isi detail sesuai dengan data yang benar ya.
              </DialogDescription>
            </DialogHeader>
            <FormProvider {...releaseForm}>
              <form onSubmit={releaseForm.handleSubmit(handleAddReleaseSubmit)} className="space-y-4 py-4">
                {renderFormFields(false)}
                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isSaving}>Batal</Button>
                  </DialogClose>
                  <Button type="submit" className="w-full sm:w-auto" disabled={isSaving || !activeConfig}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                    Tambah & Simpan
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditReleaseDialogOpen} onOpenChange={(open) => {
          if (!isSaving) {
            setIsEditReleaseDialogOpen(open);
            if (!open) {
              releaseForm.reset();
              setEditingReleaseRowIndex(null);
              setArtworkPreview(null);
              setAudioFileName(null);
            }
          }
        }}>
          <DialogContent className="w-[90vw] max-w-lg sm:max-w-[525px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Edit Rilisan</DialogTitle>
              <DialogDescription>
                Perbarui detail rilisan musik. Perubahan akan otomatis disimpan ke Google Sheet.
              </DialogDescription>
            </DialogHeader>
            <FormProvider {...releaseForm}>
              <form onSubmit={releaseForm.handleSubmit(handleEditReleaseSubmit)} className="space-y-4 py-4">
                {renderFormFields(true)}
                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isSaving}>Batal</Button>
                  </DialogClose>
                  <Button type="submit" className="w-full sm:w-auto" disabled={isSaving || !activeConfig}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan Perubahan
                  </Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </DialogContent>
        </Dialog>

        {selectedReleaseForDetail && (
            <ReleaseDetailDialog
            release={selectedReleaseForDetail.data}
            isOpen={isDetailDialogOpen}
            onOpenChange={setIsDetailDialogOpen}
            onEdit={() => {
                setIsDetailDialogOpen(false);
                const originalRowIndex = editableRows.findIndex(row => {
                    const actualIdCol = columnIndices.actualIdRilisColumn;
                    if (actualIdCol === -1) return false; 
                    
                    let systemIdInRow = String(row[actualIdCol] || "");
                    let idToMatch = selectedReleaseForDetail.data.idRilis || "";

                    if (activeConfig?.configId === 'i-musician-sheet' && idToMatch.startsWith('No. ')) {
                         return editableRows.indexOf(row) === selectedReleaseForDetail.rowIndex;
                    }
                    return systemIdInRow === idToMatch;
                });
                const rowIndexToEdit = originalRowIndex > -1 ? originalRowIndex : selectedReleaseForDetail.rowIndex;
                handleEditRelease(rowIndexToEdit);
            }}
            onDelete={() => {
                setIsDetailDialogOpen(false);
                 const originalRowIndex = editableRows.findIndex(row => {
                    const actualIdCol = columnIndices.actualIdRilisColumn;
                    if (actualIdCol === -1) return false;
                    
                    let systemIdInRow = String(row[actualIdCol] || "");
                    let idToMatch = selectedReleaseForDetail.data.idRilis || "";

                    if (activeConfig?.configId === 'i-musician-sheet' && idToMatch.startsWith('No. ')) {
                         return editableRows.indexOf(row) === selectedReleaseForDetail.rowIndex;
                    }
                    return systemIdInRow === idToMatch;
                });
                const rowIndexToDelete = originalRowIndex > -1 ? originalRowIndex : selectedReleaseForDetail.rowIndex;
                handleDeleteRow(rowIndexToDelete);
            }}
            disabled={isLoading || isSaving || !activeConfig}
            />
        )}

        <Button
          onClick={() => {
            if (!isSaving) {
              releaseForm.reset({
                  releaseTitle: "", artist: "", upcCode: "", isrcCode: "", status: "Upload",
                  existingArtworkUrl: "", existingAudioUrl: "",
                  idRilis: generateNewIdRilis(), 
                  tanggalTayang: "" 
              });
              setArtworkPreview(null);
              setAudioFileName(null);
              setIsAddReleaseDialogOpen(true);
            }
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-20"
          size="icon"
          disabled={isLoading || isSaving || (data.headers.length === 0 && !data.error && editableRows.length === 0 && !isLoading) || !activeConfig}
          title="Tambah Rilisan Baru"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="sr-only">Tambah Rilisan Baru</span>
        </Button>
      </div>
    </div>
  );
}

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className ?? ''}`}>
    {children}
  </div>
);
const CardHeader = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className ?? ''}`}>{children}</div>
);
const CardTitle = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <h3 className={`text-xl sm:text-2xl font-semibold leading-none tracking-tight ${className ?? ''}`}>{children}</h3>
);
const CardContent = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`p-6 pt-0 ${className ?? ''}`}>{children}</div>
);

const credentials = {
    client_email: "spreadsheetvt@appvtd.iam.gserviceaccount.com" 
};
