import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

type MaterialType = 'pdf' | 'video' | 'link';

interface AddMaterialDependencies {
  courseId: string;
  newTitle: string;
  newType: MaterialType;
  newUrl: string;
  uploadFile: File | null;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  setNewTitle: Dispatch<SetStateAction<string>>;
  setNewUrl: Dispatch<SetStateAction<string>>;
  setUploadFile: Dispatch<SetStateAction<File | null>>;
  setIsAddOpen: Dispatch<SetStateAction<boolean>>;
  loadData: () => Promise<void>;
}

export function createHandleAddMaterial({
  courseId,
  newTitle,
  newType,
  newUrl,
  uploadFile,
  setIsUploading,
  setNewTitle,
  setNewUrl,
  setUploadFile,
  setIsAddOpen,
  loadData,
}: AddMaterialDependencies) {
  return async () => {
    if (!newTitle) {
      toast.error('يرجى إدخال عنوان المادة');
      return;
    }
    setIsUploading(true);
    let finalUrl = newUrl;
    if (newType === 'pdf' && uploadFile) {
      const fileName = `${Date.now()}-${uploadFile.name}`;
      const { error } = await supabase.storage.from('materials').upload(fileName, uploadFile);
      if (error) { toast.error('فشل رفع الملف'); setIsUploading(false); return; }
      const { data: pubData } = supabase.storage.from('materials').getPublicUrl(fileName);
      finalUrl = pubData.publicUrl;
    } else if (!newUrl) {
      toast.error('يرجى إدخال الرابط أو اختيار ملف');
      setIsUploading(false);
      return;
    }
    const { error } = await supabase.from('course_materials').insert({
      course_id: courseId, title: newTitle, type: newType, url: finalUrl
    });
    if (error) toast.error('فشل حفظ المادة');
    else {
      toast.success('تمت الإضافة بنجاح');
      setNewTitle(''); setNewUrl(''); setUploadFile(null); setIsAddOpen(false); loadData();
    }
    setIsUploading(false);
  };
}
