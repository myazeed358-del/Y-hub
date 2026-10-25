import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
const mock = vi.hoisted(() => ({ createDefinition: vi.fn(), createSection: vi.fn(), instructors: vi.fn() }));
vi.mock('../services/repository', () => ({ academicRepository: mock }));
import { DefinitionForm } from '../components/DefinitionForm';
import { SectionForm } from '../components/SectionForm';
const def = { id: 'definition', title: 'Calculus', code: 'M1', description: null, department: null, academic_major: 'mathematics', legacy_course_id: null, created_at: '' };
beforeEach(() => { vi.clearAllMocks(); mock.instructors.mockResolvedValue([]); });
afterEach(cleanup);
it('keeps failed definition input and the same idempotency ID on retry', async () => {
  mock.createDefinition.mockRejectedValueOnce(Error('lost reply')).mockResolvedValueOnce(undefined);
  const saved = vi.fn(); render(<DefinitionForm ar={false} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText('Definition title'), { target: { value: 'Calculus' } });
  fireEvent.click(screen.getByText('Save definition'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Definition title')).toHaveValue('Calculus');
  fireEvent.click(screen.getByText('Save definition'));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(mock.createDefinition.mock.calls[0][0].id).toBe(mock.createDefinition.mock.calls[1][0].id);
});
it('creates instructor sections for self with the chosen definition', async () => {
  mock.createSection.mockResolvedValue(undefined);
  render(<SectionForm definition={def} userId="instructor" admin={false} ar={false} onSaved={() => {}} />);
  expect(screen.queryByLabelText('Assigned instructor')).toBeNull();
  fireEvent.change(screen.getByLabelText('Section label'), { target: { value: '02' } });
  fireEvent.change(screen.getByLabelText('Academic term'), { target: { value: 'Fall' } });
  fireEvent.click(screen.getByText('Create section'));
  await waitFor(() => expect(mock.createSection).toHaveBeenCalled());
  expect(mock.createSection.mock.calls[0][0]).toMatchObject({ definition: 'definition', instructor: 'instructor', label: '02', term: 'Fall' });
});
it('blocks duplicate submissions until acknowledgment', async () => {
  let resolve!: () => void; mock.createDefinition.mockReturnValue(new Promise<void>(r => { resolve = r; }));
  render(<DefinitionForm ar={false} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText('Definition title'), { target: { value: 'One' } });
  fireEvent.click(screen.getByText('Save definition')); fireEvent.click(screen.getByText('Save definition'));
  expect(mock.createDefinition).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
});
it('offers explicit instructor assignment to admins in Arabic', async () => {
  mock.instructors.mockResolvedValue([{ id: 'teacher', full_name: 'دكتور الاختبار' }]);
  render(<SectionForm definition={def} userId="admin" admin ar onSaved={() => {}} />);
  expect(await screen.findByText('دكتور الاختبار')).toBeInTheDocument();
  expect(screen.getByLabelText('الدكتور المكلّف')).toBeRequired();
});
