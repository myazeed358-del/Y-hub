import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuditExportButton } from '../components/AuditExportButton';
import * as api from '../services/auditExportRepository';
import { event } from './fixtures';
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
vi.mock('../services/auditExportRepository',()=>({exportAuditPage:vi.fn(),downloadAuditExport:vi.fn()}));
const mocked=vi.mocked(api);
const data: api.AuditExport={format_version:1,export_id:event.id,issued_at:'2026-11-28T12:00:00Z',scope:'selected_page',events:[event]};
beforeEach(()=>vi.resetAllMocks());afterEach(cleanup);
it('downloads only a successful server export and describes issuance honestly',async()=>{
 mocked.exportAuditPage.mockResolvedValue(data);
 render(<AuditExportButton ids={[event.id]} disabled={false}/>);
 fireEvent.click(screen.getByRole('button'));
 await screen.findByText('Export issued and download requested. Check your browser downloads.');
 expect(mocked.downloadAuditExport).toHaveBeenCalledWith(data);
});
it('prevents empty and disabled export',()=>{
 const {rerender}=render(<AuditExportButton ids={[]} disabled={false}/>);
 expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
 rerender(<AuditExportButton ids={[event.id]} disabled/>);
 expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
 expect(mocked.exportAuditPage).not.toHaveBeenCalled();
});
it('coalesces double clicks and cancels a late download when unmounted',async()=>{
 let resolve!:(value:api.AuditExport)=>void;
 mocked.exportAuditPage.mockReturnValue(new Promise(done=>{resolve=done;}));
 const {unmount}=render(<AuditExportButton ids={[event.id]} disabled={false}/>);
 fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));
 expect(mocked.exportAuditPage).toHaveBeenCalledOnce();
 const signal=mocked.exportAuditPage.mock.calls[0][1];unmount();expect(signal.aborted).toBe(true);
 await act(async()=>resolve(data));expect(mocked.downloadAuditExport).not.toHaveBeenCalled();
});
it('cancels export when the page starts loading another selection',async()=>{
 let resolve!:(value:api.AuditExport)=>void;
 mocked.exportAuditPage.mockReturnValue(new Promise(done=>{resolve=done;}));
 const {rerender}=render(<AuditExportButton ids={[event.id]} disabled={false}/>);
 fireEvent.click(screen.getByRole('button'));
 rerender(<AuditExportButton ids={[event.id]} disabled/>);
 await act(async()=>resolve(data));expect(mocked.downloadAuditExport).not.toHaveBeenCalled();
});
it('never downloads on failure or reveals database errors',async()=>{
 mocked.exportAuditPage.mockRejectedValue(new Error('private SQL'));
 render(<AuditExportButton ids={[event.id]} disabled={false}/>);
 fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');
 expect(screen.queryByText('private SQL')).toBeNull();expect(mocked.downloadAuditExport).not.toHaveBeenCalled();
});
