import { YSheetsHostAdapter } from
  '@/features/y-sheets/integration/YSheetsHostAdapter';

export default function YSheetsPage() {
  return (
    <div style={{ height: 'calc(100vh - 80px)', minHeight: 500 }}>
      <YSheetsHostAdapter />
    </div>
  );
}
