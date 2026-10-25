import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: mock }));
import { academicRepository as repo } from '../services/repository';
const id = '10000000-0000-4000-8000-000000000001';
const definition = { id, title: 'Calculus', code: 'M1', description: '', department: 'Science', major: 'mathematics' };
const section = { id, definition: id, instructor: '20000000-0000-4000-8000-000000000001', label: '01', term: 'Fall' };
beforeEach(() => { vi.resetAllMocks(); mock.rpc.mockResolvedValue({ data: id, error: null }); });
it('creates a catalog definition without a client actor/role parameter', async () => {
  await repo.createDefinition(definition);
  expect(mock.rpc).toHaveBeenCalledWith('create_course_definition', { p_id: id, p_title: 'Calculus', p_code: 'M1', p_description: '', p_department: 'Science', p_major: 'mathematics' });
});
it('creates a linked section with a stable retry identity', async () => {
  await repo.createSection(section); await repo.createSection(section);
  expect(mock.rpc.mock.calls[0]).toEqual(mock.rpc.mock.calls[1]);
  expect(mock.rpc.mock.calls[0][1]).toMatchObject({ p_definition: id, p_instructor: section.instructor, p_id: id });
});
it.each([null, 'wrong-id'])('rejects unconfirmed success %s', async data => {
  mock.rpc.mockResolvedValue({ data, error: null });
  await expect(repo.createSection(section)).rejects.toThrow('not confirmed');
});
it('propagates RLS/RPC errors', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: Error('denied') });
  await expect(repo.createDefinition(definition)).rejects.toThrow('denied');
});
it.each(['', 'x'.repeat(201)])('rejects invalid definition titles', async title => {
  expect(() => repo.createDefinition({ ...definition, title })).toThrow(); expect(mock.rpc).not.toHaveBeenCalled();
});
it('requires an instructor and definition UUID', () => {
  expect(() => repo.createSection({ ...section, instructor: '' })).toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('bounds instructor pages', async () => {
  mock.rpc.mockResolvedValue({ data: [], error: null }); await repo.instructors('Ada', 2);
  expect(mock.rpc).toHaveBeenCalledWith('list_assignable_instructors', { p_search: 'Ada', p_offset: 100 });
  await expect(repo.instructors('', -1)).rejects.toThrow('Invalid page');
});
it('uses an invoker section view and server pagination', async () => {
  const query = { select: vi.fn().mockReturnThis(), ilike: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(), returns: vi.fn().mockResolvedValue({ data: [], error: null }) };
  mock.from.mockReturnValue(query);
  await repo.sections('Calculus', 1);
  expect(mock.from).toHaveBeenCalledWith('course_sections'); expect(query.range).toHaveBeenCalledWith(50,99);
});
