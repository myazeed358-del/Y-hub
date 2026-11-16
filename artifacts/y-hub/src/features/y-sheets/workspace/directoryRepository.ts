import { z } from 'zod';
import { supabase } from '@/utils/supabaseClient';
const entry = z.object({
  kind: z.enum(['folder', 'workbook']), id: z.string().uuid(), name: z.string(),
  parent_id: z.string().uuid().nullable(), favorite: z.boolean(), pinned: z.boolean(),
  organization_revision: z.number().int().nonnegative(), revision: z.number().int().positive().nullable(), updated_at: z.string(),
});
export type DirectoryEntry = z.infer<typeof entry>;
export type DirectoryQuery = { parent: string | null; view: 'folder' | 'all' | 'favorite' | 'pinned'; search: string; sort: 'name' | 'updated' };
export const initialDirectory: DirectoryQuery = { parent: null, view: 'folder', search: '', sort: 'updated' };
export class DirectoryError extends Error {
  constructor(public kind: 'denied' | 'conflict' | 'invalid' | 'unavailable') { super(kind); }
}
async function call(owner: string, name: string, args: Record<string, unknown>) {
  const session = await supabase.auth.getUser();
  if (session.error || session.data.user?.id !== owner) throw new DirectoryError('denied');
  const { data, error } = await supabase.rpc(name, { p_owner: owner, ...args });
  if (error) throw new DirectoryError(error.code === '42501' ? 'denied' : error.code === 'PT409' ? 'conflict' : error.code === '22023' ? 'invalid' : 'unavailable');
  return data;
}
export const directoryRepository = {
  async browse(owner: string, query: DirectoryQuery, offset = 0) {
    const data = z.object({ items: z.array(entry).max(51), trail: z.array(z.object({ id: z.string().uuid(), name: z.string() })) }).parse(
      await call(owner, 'browse_y_sheets', { p_parent: query.parent, p_view: query.view, p_search: query.search, p_sort: query.sort, p_offset: offset, p_folders_only: false }),
    );
    return { items: data.items.slice(0, 50), more: data.items.length > 50, trail: data.trail };
  },
  async save(owner: string, item: DirectoryEntry) {
    return z.number().int().positive().parse(await call(owner, 'organize_y_sheets', {
      p_kind: item.kind, p_id: item.id, p_revision: item.organization_revision, p_parent: item.parent_id,
      p_name: item.kind === 'folder' ? item.name : null, p_favorite: item.favorite, p_pinned: item.pinned,
    }));
  },
};
