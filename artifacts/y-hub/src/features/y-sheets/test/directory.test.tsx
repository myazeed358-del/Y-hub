import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkbookDirectory } from '../workspace/WorkbookDirectory';
import { DirectoryError, type DirectoryEntry } from '../workspace/directoryRepository';
const mocks = vi.hoisted(() => ({ browse: vi.fn(), save: vi.fn() }));
vi.mock('../workspace/directoryRepository', async importOriginal => ({ ...await importOriginal<typeof import('../workspace/directoryRepository')>(), directoryRepository: mocks }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));
const item: DirectoryEntry = { kind: 'workbook', id: '00000000-0000-4000-8000-000000000001', name: 'Existing file', parent_id: null, favorite: false, pinned: false, organization_revision: 0, revision: 8, updated_at: '2026-01-01T00:00:00Z' };
const folder = { ...item, kind: 'folder' as const, id: '00000000-0000-4000-8000-000000000002', name: 'Folder', organization_revision: 1 };
const props = { owner: 'owner', busy: false, open: vi.fn(), rename: vi.fn(), remove: vi.fn() };
const page = (items: DirectoryEntry[]) => ({ items, trail: [], more: false });
beforeEach(() => { vi.clearAllMocks(); mocks.browse.mockResolvedValue(page([item, folder])); mocks.save.mockResolvedValue(1); });
afterEach(cleanup);
async function ready() { render(<WorkbookDirectory {...props}/>); await screen.findByRole('article', { name: item.name }); }
it('opens the existing workbook, and sends its displayed content revision for deletion', async () => {
 await ready(); const row = within(screen.getByRole('article', { name: item.name }));
 fireEvent.click(row.getByRole('button', { name: /Existing file/ })); expect(props.open).toHaveBeenCalledWith(item.id);
 fireEvent.click(row.getByRole('button', { name: 'Delete' })); await waitFor(() => expect(props.remove).toHaveBeenCalledWith({ id: item.id, name: item.name, revision: 8 }));
});
it('favorite uses metadata revision without copying content', async () => {
 await ready();fireEvent.click(within(screen.getByRole('article', { name: item.name })).getByRole('button', { name: 'Favorite' }));
 await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('owner', { ...item, favorite: true }));expect(props.open).not.toHaveBeenCalled();
});
it('moves the selected file into a navigated folder with original metadata revision', async () => {
 await ready();fireEvent.click(within(screen.getByRole('article', { name: item.name })).getByRole('button', { name: 'Move' }));
 mocks.browse.mockResolvedValue({ ...page([]), trail: [{ id: folder.id, name: folder.name }] });
 fireEvent.click(within(screen.getByRole('article', { name: folder.name })).getByRole('button', { name: /^Folder Folder/ }));
 await waitFor(() => expect((screen.getByRole('button', { name: 'Move here' }) as HTMLButtonElement).disabled).toBe(false));
 const confirmation=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button', { name: 'Move here' }));expect(mocks.save).not.toHaveBeenCalled();confirmation.mockReturnValue(true);fireEvent.click(screen.getByRole('button', { name: 'Move here' }));confirmation.mockRestore();await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('owner', { ...item, parent_id: folder.id }));
});
it('keeps creation identity after lost acknowledgement for safe retry', async () => {
 await ready();fireEvent.click(screen.getByRole('button', { name: 'New folder' }));fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'New' } });
 mocks.save.mockRejectedValueOnce(new DirectoryError('unavailable'));
 fireEvent.click(screen.getByRole('button', { name: 'Save folder' }));await screen.findByRole('alert');const first = mocks.save.mock.calls[0][1];
 fireEvent.click(screen.getByRole('button', { name: 'Save folder' }));await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));expect(mocks.save.mock.calls[1][1]).toEqual(first);
});
it('reports conflicts and never silently rebases a move', async () => {
 await ready();mocks.save.mockRejectedValue(new DirectoryError('conflict'));
 fireEvent.click(within(screen.getByRole('article', { name: item.name })).getByRole('button', { name: 'Pin' }));
 expect((await screen.findByRole('alert')).textContent).toContain('another device');expect(mocks.save).toHaveBeenCalledTimes(1);
});
it('clears protected metadata and pending selection on denied refresh', async () => {
 await ready();fireEvent.click(within(screen.getByRole('article', { name: item.name })).getByRole('button', { name: 'Move' }));
 mocks.browse.mockRejectedValue(new DirectoryError('denied'));fireEvent.click(screen.getByRole('button', { name: 'Refresh files' }));
 await screen.findByRole('alert');expect(screen.queryByRole('article')).toBeNull();expect(screen.queryByRole('region', { name: 'Move destination' })).toBeNull();
});
it('searches globally and filters with server parameters', async () => {
 await ready();fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Budget%' } });fireEvent.click(screen.getByRole('button', { name: 'Search' }));
 await waitFor(() => expect(mocks.browse).toHaveBeenLastCalledWith('owner', expect.objectContaining({ view: 'all', search: 'Budget%', parent: null }), 0));
});
it('ignores a late initial read after a newer focus refresh', async () => {
 let resolve!: (v: unknown) => void;mocks.browse.mockImplementationOnce(() => new Promise(r => { resolve = r; }));render(<WorkbookDirectory {...props}/>);
 fireEvent.focus(window);await screen.findByRole('article', { name: item.name });
 await act(async () => resolve(page([{ ...item, name: 'Stale' }])));expect(screen.queryByRole('article', { name: 'Stale' })).toBeNull();
});

it('renames a folder with its displayed revision and retains its parent', async () => {
 await ready(); fireEvent.click(within(screen.getByRole('article', { name: folder.name })).getByRole('button', { name: 'Rename' }));
 fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Renamed folder' } });
 fireEvent.click(screen.getByRole('button', { name: 'Save folder' }));
 await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('owner', { ...folder, name: 'Renamed folder' }));
});
it('restores the owner-scoped directory location after returning from the editor', async () => {
 const location = { current: { parent: folder.id, view: 'folder' as const, search: '', sort: 'updated' as const } };
 render(<WorkbookDirectory {...props} location={location}/>);
 await waitFor(() => expect(mocks.browse).toHaveBeenCalledWith('owner', location.current, 0));
});
