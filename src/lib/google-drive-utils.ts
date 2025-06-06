'use server';
import { Readable } from 'stream';
import { getDriveApi } from './google-sheets'; // Re-use auth and getDriveApi from google-sheets

export interface UploadFileResult {
  id: string;
  webViewLink: string;
  webContentLink: string; // For direct download if needed
}

export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  base64Content: string, // Expected format: data:image/png;base64,xxxxx OR just xxxxx
  folderId?: string // Optional: ID of the folder to upload to
): Promise<UploadFileResult> {
  const drive = await getDriveApi();
  
  const pureBase64 = base64Content.startsWith('data:') 
    ? base64Content.substring(base64Content.indexOf(',') + 1) 
    : base64Content;
  
  const fileBuffer = Buffer.from(pureBase64, 'base64');
  const stream = Readable.from(fileBuffer);

  const fileMetadata: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    name: fileName,
  };

  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: mimeType,
    body: stream,
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    if (!response.data.id || !response.data.webViewLink) {
      throw new Error('Failed to upload file to Google Drive: No file ID or webViewLink returned.');
    }

    // Attempt to make the file publicly readable
    // This requires the service account to have permission to share files.
    // If this step fails, the file might only be accessible by the service account or those it's explicitly shared with.
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone', // This makes the file publicly accessible via the link
        },
      });
    } catch (permError) {
      console.warn(`Could not set public read permissions for uploaded file ${response.data.id}. The file might not be publicly accessible via its link. Error: ${permError instanceof Error ? permError.message : String(permError)}`);
      // Do not fail the entire upload for this, but the webViewLink might require authentication or specific sharing.
    }

    return {
      id: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink || '',
    };
  } catch (error) {
    console.error('Google Drive API upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during file upload.';
    throw new Error(`Upload to Google Drive failed: ${errorMessage}`);
  }
}
