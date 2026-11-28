import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Folder, FileSpreadsheet, LayoutGrid, List } from 'lucide-react';
import { TrashPanel } from '../trash/TrashPanel';
import { trashRepository } from '../trash/repository';
import { WorkbookPreview } from './WorkbookPreview';
import { SharePanel } from '../sharing/SharePanel';
import { useLanguage } from '@/i18n/LanguageContext';
import { directoryRepository as repo, DirectoryError, initialDirectory, type DirectoryEntry, type DirectoryQuery } from './directoryRepository';

type Props = {
  owner: string; busy: boolean; location?: MutableRefObject<DirectoryQuery>;
  open: (id: string) => Promise<void>;
  rename: (id: string) => Promise<void>;
  remove: (file: { id: string; name: string; revision?: number }) => Promise<void>;
};
export function WorkbookDirectory({ owner, busy, open, rename, remove, location }: Props) {
  const { language } = useLanguage(), ar = language === 'ar';
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [query, setQuery] = useState<DirectoryQuery>(() => location?.current ?? initialDirectory);
  const [previewId,setPreviewId]=useState<string|null>(null);
  const [classifying,setClassifying]=useState<DirectoryEntry|null>(null),[categoryName,setCategoryName]=useState('');
  const [categoryFilter,setCategoryFilter]=useState(query.category??'');
  const [search, setSearch] = useState(query.search);
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [trail, setTrail] = useState<Array<{ id: string; name: string }>>([]);
  const [more, setMore] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [grid, setGrid] = useState(true);
  const [trashOpen,setTrashOpen]=useState(false),[trashVersion,setTrashVersion]=useState(0);
  const [sharing, setSharing] = useState<DirectoryEntry | null>(null);
  const [moving, setMoving] = useState<DirectoryEntry | null>(null);
  const [editing, setEditing] = useState<DirectoryEntry | null>(null);
  const alive = useRef(true), sequence = useRef(0), operation = useRef(false);
  const disabled = busy || loading;
  function report(e: unknown) {
    if (!alive.current) return;
    if (e instanceof DirectoryError && e.kind === 'denied') {
      setItems([]); setTrail([]); setSharing(null); setPreviewId(null); setClassifying(null); setMoving(null); setEditing(null); setMore(false);
    }
    setError(e instanceof DirectoryError && e.kind === 'conflict'
      ? t('This item changed on another device. Refresh and review before retrying.', 'تغيّر العنصر على جهاز آخر. حدّث القائمة وراجعه قبل إعادة المحاولة.')
      : e instanceof DirectoryError && e.kind === 'invalid'
        ? t('Invalid name or destination. A folder cannot contain itself or an ancestor.', 'الاسم أو الوجهة غير صالحين. لا يمكن وضع المجلد داخل نفسه أو أحد فروعه.')
        : t('Directory unavailable. Check your connection and access, then retry.', 'تعذر الوصول إلى الملفات. تحقق من الاتصال والصلاحية ثم أعد المحاولة.'));
  }
  async function load(next: DirectoryQuery, append = false) {
    const request = ++sequence.current;
    setLoading(true); setError('');
    if (!append) { setPreviewId(null); setItems([]); setMore(false); setTrail([]); }
    try {
      const result = await repo.browse(owner, next, append ? items.length : 0);
      if (!alive.current || request !== sequence.current) return;
      setItems(old => append ? [...old, ...result.items.filter(n => !old.some(o => o.id === n.id && o.kind === n.kind))] : result.items);
      setTrail(result.trail); setMore(result.more);
    } catch (e) { if (request === sequence.current) report(e); }
    finally { if (alive.current && request === sequence.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true; if (location) location.current = query; void load(query);
    const focus = () => { if (!operation.current) void load(query); };
    window.addEventListener("focus", focus);
    return () => { alive.current = false; sequence.current++; window.removeEventListener("focus", focus); };
  }, [owner, query]);
  const navigate = (parent: string | null) => {
    setSearch(''); setCategoryFilter(''); setQuery({ ...query, parent, view: 'folder', search: '', category:null });
  };
  async function mutate(action: () => Promise<unknown>, done?: () => void) {
    if (operation.current || disabled) return;
    operation.current = true; setLoading(true); setError('');
    try {
      await action();
      if (!alive.current) return;
      done?.(); setTrashVersion(v=>v+1); await load(query);
    } catch (e) { report(e); }
    finally { operation.current = false; if (alive.current) setLoading(false); }
  }
  const newFolder = () => setEditing({ kind: 'folder', id: crypto.randomUUID(), name: '', parent_id: query.parent,
    favorite: false, pinned: false, organization_revision: 0, revision: null, updated_at: '' });
  const destination = query.view === 'folder' && query.search === '';
  return <section className="ys-browser" aria-label={t('Workbook directory', 'دليل الملفات')}>
    <div className="ys-section-heading">
      <h2>{t('Files and folders', 'الملفات والمجلدات')}</h2>
      <div className="ys-file-view-controls">
        <button className="ys-view-toggle" aria-label="Card view" aria-pressed={grid} onClick={() => setGrid(true)}><LayoutGrid size={18}/></button>
        <button className="ys-view-toggle" aria-label="All files list" aria-pressed={!grid} onClick={() => setGrid(false)}><List size={18}/></button>
        <button className="ys-secondary-button" disabled={disabled || !destination} onClick={newFolder}>{t('New folder', 'مجلد جديد')}</button>
      </div>
    </div>
    <nav className="ys-directory-path" aria-label={t('Folder path', 'مسار المجلد')}>
      <button disabled={disabled} onClick={() => navigate(null)}>{t('My files', 'ملفاتي')}</button>
      {trail.map(f => <button key={f.id} disabled={disabled} onClick={() => navigate(f.id)}><span aria-hidden="true"> / </span>{f.name}</button>)}
    </nav>
    <form className="ys-search-row" onSubmit={e => { e.preventDefault(); setQuery({ ...query, search, parent: null, view: 'all' }); }}>
      <input type="search" maxLength={200} aria-label={t('Search all files and folders', 'البحث في جميع الملفات والمجلدات')} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search names in every folder', 'ابحث بالأسماء في جميع المجلدات')}/>
      <button className="ys-secondary-button" disabled={disabled}>{t('Search', 'بحث')}</button>
      <button type="button" className="ys-secondary-button" disabled={disabled} onClick={() => void load(query)}>{t('Refresh files', 'تحديث الملفات')}</button>
    </form>
    <div className="ys-directory-tools">
      <label>{t('Show', 'عرض')} <select aria-label={t('Directory filter', 'تصفية الملفات')} value={query.view} disabled={disabled} onChange={e => { setSearch(''); setQuery({ ...query, view: e.target.value as DirectoryQuery['view'], search: '' }); }}>
        <option value="folder">{t('Current folder', 'المجلد الحالي')}</option><option value="all">{t('All files and folders', 'جميع الملفات والمجلدات')}</option>
        <option value="favorite">{t('Favorites', 'المفضلة')}</option><option value="pinned">{t('Pinned', 'المثبتة')}</option>
      </select></label>
      <label>{t('Sort', 'ترتيب')} <select aria-label={t('Directory sort', 'ترتيب الملفات')} value={query.sort} disabled={disabled} onChange={e => setQuery({ ...query, sort: e.target.value as DirectoryQuery['sort'] })}>
        <option value="name">{t('Name', 'الاسم')}</option><option value="updated">{t('Recently updated', 'آخر تعديل')}</option>
      </select></label>
    </div>
    <form className="ys-search-row" onSubmit={e=>{e.preventDefault();setQuery({...query,category:categoryFilter.trim()||null,view:'all'});}}>
      <input aria-label={t('Category filter','تصفية حسب التصنيف')} maxLength={40} value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} placeholder={t('Category name','اسم التصنيف')}/>
      <button className="ys-secondary-button" disabled={disabled}>{t('Filter category','تصفية التصنيف')}</button>
      <button className="ys-secondary-button" type="button" disabled={disabled} onClick={()=>{setCategoryFilter('');setQuery({...query,category:'',view:'all'});}}>{t('Unclassified','غير مصنف')}</button>
      <button className="ys-secondary-button" type="button" disabled={disabled} onClick={()=>{setCategoryFilter('');setQuery({...query,category:null});}}>{t('All categories','جميع التصنيفات')}</button>
    </form>
    {query.category!==undefined&&query.category!==null&&<p>{t('Category','التصنيف')}: <bdi>{query.category||t('Unclassified','غير مصنف')}</bdi></p>}
    {classifying&&<form className="ys-directory-edit" aria-label={t('Classify item','تصنيف العنصر')} onSubmit={e=>{e.preventDefault();void mutate(()=>repo.classify(owner,classifying,categoryName),()=>setClassifying(null));}}>
      <p><bdi>{classifying.name}</bdi></p>
      <label>{t('Item category','تصنيف العنصر')} <input autoFocus maxLength={40} disabled={disabled} value={categoryName} onChange={e=>setCategoryName(e.target.value)}/></label>
      <p>{t('Leave empty to remove the category. Categories do not change sharing.','اتركه فارغًا لإزالة التصنيف. التصنيفات لا تغيّر المشاركة.')}</p>
      <button className="ys-secondary-button" disabled={disabled}>{t('Save category','حفظ التصنيف')}</button>
      <button className="ys-secondary-button" type="button" disabled={disabled} onClick={()=>setClassifying(null)}>{t('Cancel category','إلغاء التصنيف')}</button>
    </form>}
    <p className="ys-files-subtitle">{t('Pinned items appear first. New workbooks start in My files; move them to a folder when ready.', 'تظهر العناصر المثبتة أولًا. تُنشأ الجداول الجديدة في ملفاتي؛ يمكنك نقلها إلى مجلد بعد إنشائها.')}</p>
    {error && <p role="alert" className="y-sheets-workspace-error">{error}</p>}
    {loading && <p role="status">{t('Loading…', 'جارٍ التحميل…')}</p>}
    <button className="ys-secondary-button" disabled={disabled} onClick={()=>{setTrashOpen(true);setTrashVersion(v=>v+1);}}>{t('Open trash','فتح السلة')}</button>
    {trashOpen&&<TrashPanel key={trashVersion} actor={owner} onClose={()=>setTrashOpen(false)} onRestored={()=>{setSearch('');setQuery({...initialDirectory});}}/>}
    {sharing && <SharePanel key={sharing.id} actor={owner} id={sharing.id} name={sharing.name} kind={sharing.kind} onClose={() => setSharing(null)}/>}
    {editing && <form className="ys-directory-edit" aria-label={t('Folder name form', 'تسمية المجلد')} onSubmit={e => { e.preventDefault(); void mutate(() => repo.save(owner, editing), () => setEditing(null)); }}>
      <label>{t('Folder name', 'اسم المجلد')} <input autoFocus maxLength={200} value={editing.name} disabled={disabled} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
      <button className="ys-secondary-button" disabled={disabled || !editing.name.trim()}>{t('Save folder', 'حفظ المجلد')}</button>
      <button className="ys-secondary-button" type="button" disabled={disabled} onClick={() => setEditing(null)}>{t('Cancel', 'إلغاء')}</button>
    </form>}
    {moving && <div className="ys-directory-edit" role="region" aria-label={t('Move destination', 'وجهة النقل')}>
      <p>{t('Moving', 'نقل')}: <bdi>{moving.name}</bdi>. {t('Open the destination folder, then choose Move here.', 'افتح مجلد الوجهة ثم اختر النقل إلى هنا.')}</p>
      <button className="ys-secondary-button" disabled={disabled || !destination} onClick={() => { if(window.confirm(t('Moving changes inherited access for this item and its contents to match the destination. Independent direct shares remain. Continue?', 'يغيّر النقل الوصول الموروث لهذا العنصر ومحتوياته بحسب الوجهة، وتبقى المشاركات المباشرة المستقلة. هل تريد المتابعة؟'))) void mutate(() => repo.save(owner, { ...moving, parent_id: query.parent }), () => setMoving(null)); }}>{t('Move here', 'نقل إلى هنا')}</button>
      <button className="ys-secondary-button" disabled={disabled} onClick={() => setMoving(null)}>{t('Cancel move', 'إلغاء النقل')}</button>
    </div>}
    {!loading && items.length === 0 && <p>{t('No matching files or folders.', 'لا توجد ملفات أو مجلدات مطابقة.')}</p>}
    <div className={grid ? 'ys-file-cards' : 'ys-file-list'}>
      {items.map(item => <article className={`ys-file-card${previewId===item.id?' ys-preview-expanded':''}`} key={item.kind + item.id} aria-label={item.name}>
        <button className="ys-file-open" disabled={disabled} onClick={() => item.kind === 'folder' ? navigate(item.id) : void open(item.id)}>
          <span className="ys-file-preview" aria-hidden="true">{item.kind === 'folder' ? <Folder size={26}/> : <FileSpreadsheet size={26}/>}</span>
          <span className="ys-file-details"><strong dir="auto">{item.name}</strong><small>{item.kind === 'folder' ? t('Folder', 'مجلد') : t('Workbook', 'جدول')}{item.pinned ? ' · 📌' : ''}{item.favorite ? ' · ★' : ''}{item.category ? ` · ${item.category}` : ''}</small><small><time dateTime={item.updated_at}>{new Intl.DateTimeFormat(ar ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.updated_at))}</time></small></span>
        </button>
        {previewId===item.id&&item.kind==='workbook'&&item.revision&&<WorkbookPreview key={`${owner}:${item.id}:${item.revision}`} owner={owner} id={item.id} revision={item.revision} onClose={()=>setPreviewId(null)}/>}
        <div className="ys-directory-actions">
          {item.kind==='workbook'&&<button disabled={disabled} onClick={()=>setPreviewId(previewId===item.id?null:item.id)}>{t('Preview','معاينة')}</button>}
          <button disabled={disabled} onClick={()=>{setClassifying(item);setCategoryName(item.category??'');}}>{t('Classify','تصنيف')}</button>
          <button disabled={disabled} aria-pressed={item.favorite} onClick={() => void mutate(() => repo.save(owner, { ...item, favorite: !item.favorite }))}>{t('Favorite', 'مفضلة')}</button>
          <button disabled={disabled} aria-pressed={item.pinned} onClick={() => void mutate(() => repo.save(owner, { ...item, pinned: !item.pinned }))}>{t('Pin', 'تثبيت')}</button>
          <button disabled={disabled} onClick={() => setMoving(item)}>{t('Move', 'نقل')}</button>
          <button disabled={disabled} onClick={() => item.kind === 'folder' ? setEditing(item) : void mutate(() => rename(item.id))}>{t('Rename', 'إعادة تسمية')}</button>
          <button disabled={disabled} onClick={() => setSharing(item)}>{t('Share', 'مشاركة')}</button>
          <button disabled={disabled} onClick={() => {if(item.kind==='workbook')void mutate(() => remove({ id: item.id, name: item.name, revision: item.revision ?? undefined }));else if(window.confirm(t('Move this folder and all its contents to trash for 30 days? Shared access stops immediately.', 'هل تريد نقل المجلد وجميع محتوياته إلى السلة لمدة 30 يومًا؟ يتوقف الوصول المشترك فورًا.')))void mutate(()=>trashRepository.trash(owner,'folder',item.id,item.organization_revision));}}>{t('Delete', 'حذف')}</button>
        </div>
      </article>)}
    </div>
    {more && <button className="ys-secondary-button ys-load-more" disabled={disabled} onClick={() => void load(query, true)}>{t('Load more files', 'تحميل المزيد')}</button>}
  </section>;
}
