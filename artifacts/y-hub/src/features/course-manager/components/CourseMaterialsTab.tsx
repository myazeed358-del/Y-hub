import type {
  ChangeEvent,
  Dispatch,
  SetStateAction,
} from 'react';
import {
  Card,
} from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/y-hub-ds/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import { TabsContent } from '@workspace/y-hub-ds/components/ui/tabs';
import {
  FileText,
  Trash2,
  Loader2,
  Plus,
} from 'lucide-react';

type MaterialType = 'pdf' | 'video' | 'link';

interface CourseMaterialsTabProps {
  materials: any[];
  isAddOpen: boolean;
  setIsAddOpen: Dispatch<SetStateAction<boolean>>;
  newTitle: string;
  setNewTitle: Dispatch<SetStateAction<string>>;
  newType: MaterialType;
  setNewType: Dispatch<SetStateAction<MaterialType>>;
  newUrl: string;
  setNewUrl: Dispatch<SetStateAction<string>>;
  setUploadFile: Dispatch<SetStateAction<File | null>>;
  isUploading: boolean;
  handleAddMaterial: () => Promise<void>;
  handleDeleteMaterial: (id: string) => Promise<void>;
}

export function CourseMaterialsTab({
  materials,
  isAddOpen,
  setIsAddOpen,
  newTitle,
  setNewTitle,
  newType,
  setNewType,
  newUrl,
  setNewUrl,
  setUploadFile,
  isUploading,
  handleAddMaterial,
  handleDeleteMaterial,
}: CourseMaterialsTabProps) {
  return (
        <TabsContent value="materials">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">ملفات وروابط المقرر</h2>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus size={16} /> إضافة مادة</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>إضافة مادة</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><label className="text-sm font-semibold mb-1 block">عنوان المادة</label><Input value={newTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} /></div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">النوع</label>
                    <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">ملف (PDF)</SelectItem>
                        <SelectItem value="video">فيديو</SelectItem>
                        <SelectItem value="link">رابط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newType === 'pdf' ? (
                    <div><label className="text-sm font-semibold mb-1 block">اختر ملف</label><Input type="file" accept=".pdf" onChange={(e: ChangeEvent<HTMLInputElement>) => setUploadFile(e.target.files?.[0] || null)} /></div>
                  ) : (
                    <div><label className="text-sm font-semibold mb-1 block">الرابط</label><Input dir="ltr" value={newUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)} /></div>
                  )}
                  <Button className="w-full" onClick={handleAddMaterial} disabled={isUploading}>{isUploading ? <Loader2 className="animate-spin" size={16}/> : 'حفظ'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {materials.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-muted/30 border-dashed border rounded-xl">
                <FileText className="mx-auto text-muted-foreground opacity-50 mb-4" size={48} />
                <h3 className="text-lg font-bold">لا يوجد مواد حتى الآن</h3>
                <p className="text-muted-foreground mt-2">قم بإنشاء مواد وروابط لمقررك ليتمكن الطلاب من تصفحها.</p>
              </div>
            ) : (
              materials.map((mat) => (
                <Card key={mat.id} className="flex flex-row items-center p-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ml-4"><FileText size={24} /></div>
                  <div className="flex-1"><h4 className="font-bold">{mat.title}</h4><p className="text-xs text-muted-foreground uppercase">{mat.type}</p></div>
                  <Button variant="ghost" className="text-destructive" onClick={() => handleDeleteMaterial(mat.id)}><Trash2 size={16} /></Button>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
  );
}
