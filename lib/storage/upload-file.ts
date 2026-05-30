import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type UploadFileParams = {
  bucket: string;
  file: File;
  tenantId: string;
  folder?: string;
};

export async function uploadFile({
  bucket,
  file,
  tenantId,
  folder,
}: UploadFileParams) {
  try {
    const fileExt =
      file.name.split(".").pop();

    const fileName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

    // MULTI-TENANT PATH
    const filePath = folder
      ? `${tenantId}/${folder}/${fileName}`
      : `${tenantId}/${fileName}`;

    const { error } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, file);

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      success: true,
      path: filePath,
      publicUrl,
    };

  } catch (error) {
    console.error(error);

    return {
      success: false,
      publicUrl: null,
      path: null,
    };
  }
}