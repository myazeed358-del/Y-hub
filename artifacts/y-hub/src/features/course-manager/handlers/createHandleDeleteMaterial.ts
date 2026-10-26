import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

interface DeleteMaterialDependencies {
  materials: any[];
  loadData: () => Promise<void>;
}

export function createHandleDeleteMaterial({
  materials,
  loadData,
}: DeleteMaterialDependencies) {
  return async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المادة؟')) {
      const mat = materials.find(m => m.id === id);
      // Remove the stored PDF before deleting its course entry.
      if (mat?.type === 'pdf' && mat.url) {
        const fileName = mat.url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage.from('materials').remove([fileName]);
          if (storageError) {
            toast.error('فشل حذف الملف من التخزين السحابي');
            console.error(storageError);
            return;
          }
        }
      }

      const { error: dbError } = await supabase.from('course_materials').delete().eq('id', id);
      if (dbError) {
        toast.error('فشل حذف المادة من قاعدة البيانات');
      } else {
        toast.success('تم الحذف بنجاح');
        loadData();
      }
    }
  };
}
