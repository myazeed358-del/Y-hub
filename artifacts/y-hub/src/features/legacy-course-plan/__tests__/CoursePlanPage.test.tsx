import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const state = vi.hoisted(() => ({ language: 'ar' }));
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: () => state }));
import CoursePlanPage from '../pages/CoursePlanPage';
describe('section plan composition', () => {
 it('renders the Arabic section plan with RTL', () => {
  state.language='ar'; const html=renderToStaticMarkup(<CoursePlanPage />);
  expect(html).toContain('خطة الشعبة الدراسية'); expect(html).toContain('dir="rtl"');
 });
 it('uses the real supplied syllabus without defaulting to a fuzzy course', () => {
  const html=renderToStaticMarkup(<CoursePlanPage learningPath={<div>Actual enrolled section</div>} />);
  expect(html).toContain('Actual enrolled section'); expect(html).not.toContain('course-week-');
 });
 it('preserves the independent reference URL without claiming completed lessons', () => {
  const html=renderToStaticMarkup(<CoursePlanPage />);
  expect(html).toContain('href="/lesson/introduction"'); expect(html).not.toContain('unitsCompleted'); expect(html).not.toContain('%');
 });
 it('supports English without a fictitious duration or stages', () => {
  state.language='en'; const html=renderToStaticMarkup(<CoursePlanPage />);
  expect(html).toContain('Section learning plan'); expect(html).not.toContain('١٥'); expect(html).not.toContain('٤');
 });
});
