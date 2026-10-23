import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkbookProvider } from '../state/workbookContext';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { FormulaBar } from '../components/FormulaBar/FormulaBar';
import { Grid } from '../components/Grid/Grid';
import { SheetTabs } from '../components/SheetTabs/SheetTabs';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { createDefaultWorkbook } from '../state/defaultWorkbook';

const MockApp: React.FC = () => {
  const wb = createDefaultWorkbook();
  return (
    <WorkbookProvider initialWorkbook={wb}>
      <Toolbar />
      <FormulaBar />
      <div style={{ height: 400, width: 800, position: 'relative' }}>
        <Grid />
      </div>
      <SheetTabs />
      <StatusBar />
    </WorkbookProvider>
  );
};

describe('Spreadsheet UI Behavior', () => {
  it('renders application toolbar, title, and buttons', () => {
    render(<MockApp />);
    expect(screen.getByText('Y-Sheets')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'File' }));
    expect(screen.getByRole('button', { name: 'New workbook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Excel or CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export workbook' })).toBeInTheDocument();
  });

  it('uses the approved Y-Hub identity and groups existing commands into tabs', () => {
    render(<MockApp />);
    expect(screen.getByRole('img', { name: 'Y-Sheets by Y-Hub' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Spreadsheet tools' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Data' }));
    expect(screen.getByRole('button', { name: 'Sort ascending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data validation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Insert' }));
    expect(screen.getByRole('button', { name: 'Add worksheet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Formulas' }));
    expect(screen.getByRole('button', { name: 'Open formula entry' })).toBeInTheDocument();
  });

  it('renders formula bar with active cell and fx selector', () => {
    render(<MockApp />);
    expect(screen.getByTitle('Insert Function')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter a value or formula/i)).toBeInTheDocument();
  });

  it('renders sheet tabs and switches active sheet', () => {
    render(<MockApp />);
    const gradebookTab = screen.getByText('Gradebook');
    const budgetTab = screen.getByText('Lab Budget');

    expect(gradebookTab).toBeInTheDocument();
    expect(budgetTab).toBeInTheDocument();

    // Click to switch sheet
    fireEvent.click(budgetTab);
    expect(budgetTab.closest('div')).toHaveClass('font-bold');
  });

  it('renders status bar with Ready mode indicator', () => {
    render(<MockApp />);
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
