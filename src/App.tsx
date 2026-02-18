import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Trash2,
  Calendar,
  Upload,
  Image as ImageIcon,
  Box,
  ClipboardList,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatCurrency } from './lib/utils';
import { Transaction, TransactionFormData, InventoryMovement, InventoryFormData } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'cash' | 'inventory'>('cash');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventoryData, setInventoryData] = useState<{ initialStock: number, movements: InventoryMovement[] }>({ initialStock: 0, movements: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<'income' | 'expense' | 'stock_in' | 'stock_out' | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'income',
    description: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const [inventoryFormData, setInventoryFormData] = useState<InventoryFormData>({
    type: 'in',
    units: 0,
    description: '',
    invoice_number: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchTransactions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await fetch(`/api/transactions?month=${month}&year=${year}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al cargar transacciones');
      }
      const data = await response.json();
      setTransactions(data);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await fetch(`/api/inventory?month=${month}&year=${year}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al cargar inventario');
      }
      const data = await response.json();
      setInventoryData(data);
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogo = async () => {
    try {
      const response = await fetch('/api/settings/logo');
      const data = await response.json();
      if (data.value) setLogo(data.value);
    } catch (error) {
      console.error('Error fetching logo:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'cash') {
      fetchTransactions();
    } else {
      fetchInventory();
    }
    fetchLogo();
  }, [currentDate, activeTab]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setLogo(base64String);
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'logo', value: base64String }),
        });
      } catch (error) {
        console.error('Error saving logo:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || formData.amount <= 0) return;

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormData({
          type: 'income',
          description: '',
          amount: 0,
          date: format(new Date(), 'yyyy-MM-dd'),
        });
        setShowForm(null);
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryFormData.description || inventoryFormData.units <= 0) return;

    // Validation for stock out
    if (inventoryFormData.type === 'out' && !inventoryFormData.subtype) {
      alert('Por favor seleccione si es Venta o Regalía');
      return;
    }

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventoryFormData),
      });
      
      if (response.ok) {
        setInventoryFormData({
          type: 'in',
          units: 0,
          description: '',
          invoice_number: '',
          date: format(new Date(), 'yyyy-MM-dd'),
        });
        setShowForm(null);
        fetchInventory();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'No se pudo guardar el movimiento'}`);
      }
    } catch (error) {
      console.error('Error adding inventory:', error);
      alert('Error de conexión al intentar guardar');
    }
  };

  const handleDeleteInventory = async (id: number) => {
    try {
      const response = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchInventory();
      }
    } catch (error) {
      console.error('Error deleting inventory:', error);
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const totalIn = inventoryData.movements
    .filter(m => m.type === 'in')
    .reduce((acc, m) => acc + m.units, 0);

  const totalOut = inventoryData.movements
    .filter(m => m.type === 'out')
    .reduce((acc, m) => acc + m.units, 0);

  const totalRegalias = inventoryData.movements
    .filter(m => m.subtype === 'regalia')
    .reduce((acc, m) => acc + m.units, 0);

  const totalVentas = inventoryData.movements
    .filter(m => m.subtype === 'venta')
    .reduce((acc, m) => acc + m.units, 0);

  const currentStock = inventoryData.initialStock + totalIn - totalOut;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const monthYear = format(currentDate, 'MMMM yyyy', { locale: es });
    const downloadDate = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
    const dayNumber = format(new Date(), 'd');
    
    doc.setFillColor(22, 22, 22);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setFillColor(206, 253, 123);
    doc.rect(0, 45, 210, 2, 'F');
    
    if (logo) {
      try {
        const img = new Image();
        img.src = logo;
        const ratio = (img.width || 100) / (img.height || 100);
        let finalWidth = 35;
        let finalHeight = 35 / ratio;
        if (finalHeight > 25) {
          finalHeight = 25;
          finalWidth = 25 * ratio;
        }
        doc.addImage(logo, 'PNG', 196 - finalWidth, (45 - finalHeight) / 2, finalWidth, finalHeight);
      } catch (e) {}
    }
    
    doc.setTextColor(206, 253, 123);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CAJA CHICA SANAVI INTERNATIONAL', 14, 20);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('DIRECTOR GENERAL PARA LATINOAMÉRICA GIOVANNI COTO', 14, 27);
    doc.setFont('helvetica', 'bold');
    doc.text('ADMINISTRACIÓN DE INGRESOS Y EGRESOS', 14, 33);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`PERIODO: ${monthYear.toUpperCase()}`, 14, 58);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Fecha de emisión: ${downloadDate} | Día: ${dayNumber}`, 14, 63);

    const tableData = transactions.map(t => [
      format(new Date(t.date), 'dd/MM/yyyy'),
      t.description.toUpperCase(),
      t.type === 'income' ? 'INGRESO' : 'EGRESO',
      formatCurrency(t.amount)
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['FECHA', 'DETALLE', 'TIPO', 'MONTO']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [22, 22, 22], textColor: [206, 253, 123], fontStyle: 'bold', halign: 'center', fontSize: 10 },
      columnStyles: { 0: { halign: 'center', cellWidth: 30 }, 2: { halign: 'center', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 40, fontStyle: 'bold' } },
      styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
      alternateRowStyles: { fillColor: [248, 252, 240] },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    const summaryX = 120;
    const summaryWidth = 76;
    doc.setDrawColor(22, 22, 22);
    doc.setLineWidth(0.5);
    doc.line(summaryX, finalY, summaryX + summaryWidth, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(22, 22, 22);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN FINANCIERO', summaryX, finalY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Total Ingresos:', summaryX, finalY + 18);
    doc.setTextColor(0, 128, 0);
    doc.text(formatCurrency(totalIncome), summaryX + summaryWidth, finalY + 18, { align: 'right' });
    
    doc.setTextColor(22, 22, 22);
    doc.text('Total Egresos:', summaryX, finalY + 26);
    doc.setTextColor(200, 0, 0);
    doc.text(formatCurrency(totalExpenses), summaryX + summaryWidth, finalY + 26, { align: 'right' });
    
    doc.setDrawColor(22, 22, 22);
    doc.setLineWidth(0.1);
    doc.line(summaryX, finalY + 30, summaryX + summaryWidth, finalY + 30);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 22, 22);
    doc.text('SALDO NETO:', summaryX, finalY + 37);
    doc.setFillColor(206, 253, 123);
    doc.rect(summaryX + summaryWidth - 40, finalY + 32, 40, 7, 'F');
    doc.text(formatCurrency(balance), summaryX + summaryWidth - 2, finalY + 37, { align: 'right' });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('SANAVI INTERNATIONAL - Reporte Confidencial', 105, 285, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, 196, 285, { align: 'right' });
    }

    doc.save(`Reporte_CajaChica_${monthYear.replace(' ', '_')}.pdf`);
  };

  const handleExportInventoryPDF = () => {
    const doc = new jsPDF();
    const monthYear = format(currentDate, 'MMMM yyyy', { locale: es });
    const downloadDate = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
    const dayNumber = format(new Date(), 'd');
    
    doc.setFillColor(22, 22, 22);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setFillColor(206, 253, 123);
    doc.rect(0, 45, 210, 2, 'F');
    
    if (logo) {
      try {
        const img = new Image();
        img.src = logo;
        const ratio = (img.width || 100) / (img.height || 100);
        let finalWidth = 35;
        let finalHeight = 35 / ratio;
        if (finalHeight > 25) {
          finalHeight = 25;
          finalWidth = 25 * ratio;
        }
        doc.addImage(logo, 'PNG', 196 - finalWidth, (45 - finalHeight) / 2, finalWidth, finalHeight);
      } catch (e) {}
    }
    
    doc.setTextColor(206, 253, 123);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INVENTARIO PRIME X - SANAVI', 14, 20);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CONTROL DE STOCK DE PRODUCTO', 14, 27);
    doc.setFont('helvetica', 'bold');
    doc.text(`REPORTE MENSUAL: ${monthYear.toUpperCase()}`, 14, 33);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(`FECHA DE EMISIÓN: ${downloadDate} | Día: ${dayNumber}`, 14, 58);

    const tableData = inventoryData.movements.map(m => [
      format(new Date(m.date), 'dd/MM/yyyy'),
      m.description.toUpperCase(),
      m.subtype === 'regalia' ? 'REGALÍA' : (m.invoice_number || '-'),
      m.type === 'in' ? 'ENTRADA' : 'SALIDA',
      m.units.toString()
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['FECHA', 'DETALLE', 'FACTURA/ORDEN', 'TIPO', 'UNIDADES']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [22, 22, 22], 
        textColor: [206, 253, 123], 
        fontStyle: 'bold', 
        halign: 'center',
        fontSize: 9
      },
      columnStyles: { 
        0: { halign: 'center', cellWidth: 28 }, // Date column - Increased to prevent wrapping
        1: { halign: 'left' },                  // Detail column (flexible)
        2: { halign: 'center', cellWidth: 32 }, // Invoice/Type column
        3: { halign: 'center', cellWidth: 22 }, // Type column
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 22 } // Units column
      },
      styles: { 
        fontSize: 8.5, 
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle'
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.text[0] === 'ENTRADA') {
            data.cell.styles.textColor = [0, 128, 0];
          } else {
            data.cell.styles.textColor = [200, 0, 0];
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const summaryWidth = 70;
    const summaryX = 210 - 14 - summaryWidth; // Align to right margin
    
    // Check if summary box fits on current page
    if (finalY + 45 > 280) {
      doc.addPage();
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(summaryX, 20, summaryWidth, 42, 3, 3, 'F');
      renderSummary(20);
    } else {
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(summaryX, finalY, summaryWidth, 42, 3, 3, 'F');
      renderSummary(finalY);
    }

    function renderSummary(y: number) {
      doc.setFontSize(10);
      doc.setTextColor(22, 22, 22);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN DE STOCK', summaryX + 5, y + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Stock Inicial:', summaryX + 5, y + 16);
      doc.text(inventoryData.initialStock.toString(), summaryX + summaryWidth - 5, y + 16, { align: 'right' });
      
      doc.text('Entradas Mes:', summaryX + 5, y + 23);
      doc.text(`+${totalIn}`, summaryX + summaryWidth - 5, y + 23, { align: 'right' });

      doc.text('Salidas Mes:', summaryX + 5, y + 30);
      doc.text(`-${totalOut}`, summaryX + summaryWidth - 5, y + 30, { align: 'right' });
      
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`(Ventas: ${totalVentas} | Regalías: ${totalRegalias})`, summaryX + 5, y + 34);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(summaryX + 5, y + 36, summaryX + summaryWidth - 5, y + 36);

      doc.setFontSize(10.5);
      doc.setTextColor(22, 22, 22);
      doc.setFont('helvetica', 'bold');
      doc.text('STOCK FINAL:', summaryX + 5, y + 40);
      doc.text(currentStock.toString(), summaryX + summaryWidth - 5, y + 40, { align: 'right' });
    }

    doc.save(`Inventario_PrimeX_${monthYear.replace(' ', '_')}.pdf`);
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="min-h-screen relative">
      <div className="orbit-blob orbit-1" />
      <div className="orbit-blob orbit-2" />
      
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 relative z-10">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>{error}</span>
            </div>
            <button 
              onClick={() => activeTab === 'cash' ? fetchTransactions() : fetchInventory()}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors font-bold text-[10px] uppercase"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-8 bg-brand-card/30 p-1 rounded-2xl border border-white/5 w-fit">
          <button 
            onClick={() => setActiveTab('cash')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-medium",
              activeTab === 'cash' ? "bg-brand-accent text-brand-bg shadow-lg" : "text-brand-muted hover:text-brand-text"
            )}
          >
            <Wallet size={18} />
            Caja Chica
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-medium",
              activeTab === 'inventory' ? "bg-brand-accent text-brand-bg shadow-lg" : "text-brand-muted hover:text-brand-text"
            )}
          >
            <Package size={18} />
            Inventario Prime X
          </button>
        </div>

        <div className="flex justify-end mb-4">
          <label className="cursor-pointer group">
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <div className="flex items-center gap-2 text-xs text-brand-muted hover:text-brand-accent transition-colors">
              {logo ? (
                <div className="relative">
                  <img src={logo} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-brand-border bg-white/5 p-1" />
                  <div className="absolute -top-1 -right-1 bg-brand-accent text-brand-bg rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload size={10} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 border border-dashed border-brand-border rounded-lg hover:border-brand-accent transition-colors">
                  <ImageIcon size={16} />
                  <span>Subir Logo</span>
                </div>
              )}
            </div>
          </label>
        </div>

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-accent mb-1 uppercase">
              {activeTab === 'cash' ? 'CAJA CHICA SANAVI INTERNATIONAL' : 'INVENTARIO PRIME X - SANAVI'}
            </h1>
            <p className="text-brand-muted font-medium text-sm md:text-base">
              Director General para Latinoamérica Giovanni Coto
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-brand-card rounded-xl border border-brand-border p-1">
              <button onClick={prevMonth} className="p-2 hover:text-brand-accent transition-colors">
                <ChevronLeft size={20} />
              </button>
              <span className="px-4 font-medium min-w-[140px] text-center capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </span>
              <button onClick={nextMonth} className="p-2 hover:text-brand-accent transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
            
            <button 
              onClick={activeTab === 'cash' ? handleExportPDF : handleExportInventoryPDF}
              className="p-3 bg-brand-card border border-brand-border rounded-xl hover:border-brand-accent transition-all text-brand-accent"
              title="Descargar Reporte"
            >
              <Download size={20} />
            </button>
          </div>
        </header>

        {activeTab === 'cash' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-brand-muted text-sm font-medium uppercase tracking-wider">Ingresos</span>
                  <div className="p-2 bg-brand-accent/10 rounded-lg text-brand-accent"><TrendingUp size={18} /></div>
                </div>
                <div className="text-2xl font-bold text-brand-accent">{formatCurrency(totalIncome)}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-brand-muted text-sm font-medium uppercase tracking-wider">Egresos</span>
                  <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><TrendingDown size={18} /></div>
                </div>
                <div className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-brand-accent p-6 rounded-2xl shadow-lg shadow-brand-accent/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-brand-bg/60 text-sm font-medium uppercase tracking-wider">Saldo Total</span>
                  <div className="p-2 bg-brand-bg/10 rounded-lg text-brand-bg"><Wallet size={18} /></div>
                </div>
                <div className="text-2xl font-bold text-brand-bg">{formatCurrency(balance)}</div>
              </motion.div>
            </div>

            <div className="flex gap-4 mb-8">
              <button onClick={() => { setShowForm('income'); setFormData(prev => ({ ...prev, type: 'income' })); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-card border border-brand-border hover:border-brand-accent p-4 rounded-2xl transition-all group">
                <Plus size={20} className="text-brand-accent group-hover:scale-110 transition-transform" />
                <span className="font-medium">Nuevo Ingreso</span>
              </button>
              <button onClick={() => { setShowForm('expense'); setFormData(prev => ({ ...prev, type: 'expense' })); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-card border border-brand-border hover:border-red-500/50 p-4 rounded-2xl transition-all group">
                <Minus size={20} className="text-red-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Nuevo Egreso</span>
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-brand-accent" /> Historial del Mes</h3>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-brand-muted animate-pulse">Cargando transacciones...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-20 glass rounded-3xl border-dashed"><p className="text-brand-muted">No hay movimientos registrados en este mes.</p></div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((t) => (
                    <motion.div layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={t.id} className="group glass p-4 rounded-2xl flex items-center justify-between hover:border-brand-accent/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", t.type === 'income' ? "bg-brand-accent/10 text-brand-accent" : "bg-red-500/10 text-red-400")}>{t.type === 'income' ? <Plus size={20} /> : <Minus size={20} />}</div>
                        <div>
                          <div className="font-medium">{t.description}</div>
                          <div className="text-xs text-brand-muted">{format(new Date(t.date), 'dd MMM yyyy', { locale: es })}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className={cn("font-bold text-lg", t.type === 'income' ? "text-brand-accent" : "text-red-400")}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</div>
                        <button onClick={() => handleDeleteTransaction(t.id)} className="p-2 text-brand-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-brand-muted text-[10px] font-bold uppercase tracking-wider">Stock Inicial</span>
                  <div className="p-1.5 bg-brand-accent/10 rounded-lg text-brand-accent"><Box size={14} /></div>
                </div>
                <div className="text-xl font-bold text-brand-accent">{inventoryData.initialStock} uds</div>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-brand-muted text-[10px] font-bold uppercase tracking-wider">Entradas</span>
                  <div className="p-1.5 bg-brand-accent/10 rounded-lg text-brand-accent"><Plus size={14} /></div>
                </div>
                <div className="text-xl font-bold text-brand-accent">+{totalIn} uds</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-brand-muted text-[10px] font-bold uppercase tracking-wider">Regalías</span>
                  <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400"><Package size={14} /></div>
                </div>
                <div className="text-xl font-bold text-purple-400">{totalRegalias} uds</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-brand-muted text-[10px] font-bold uppercase tracking-wider">Ventas</span>
                  <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400"><TrendingUp size={14} /></div>
                </div>
                <div className="text-xl font-bold text-blue-400">{totalVentas} uds</div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-brand-accent p-5 rounded-2xl shadow-lg shadow-brand-accent/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-brand-bg/60 text-[10px] font-bold uppercase tracking-wider">Stock Final</span>
                  <div className="p-1.5 bg-brand-bg/10 rounded-lg text-brand-bg"><Package size={14} /></div>
                </div>
                <div className="text-xl font-bold text-brand-bg">{currentStock} uds</div>
              </motion.div>
            </div>

            <div className="flex gap-4 mb-8">
              <button onClick={() => { setShowForm('stock_in'); setInventoryFormData(prev => ({ ...prev, type: 'in', subtype: undefined })); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-card border border-brand-border hover:border-brand-accent p-4 rounded-2xl transition-all group">
                <Plus size={20} className="text-brand-accent group-hover:scale-110 transition-transform" />
                <span className="font-medium">Agregar Inventario</span>
              </button>
              <button onClick={() => { setShowForm('stock_out'); setInventoryFormData(prev => ({ ...prev, type: 'out', subtype: undefined })); }} className="flex-1 flex items-center justify-center gap-2 bg-brand-card border border-brand-border hover:border-red-500/50 p-4 rounded-2xl transition-all group">
                <Minus size={20} className="text-red-400 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Registrar Salida</span>
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><ClipboardList size={20} className="text-brand-accent" /> Movimientos de Inventario</h3>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-brand-muted animate-pulse">Cargando inventario...</p>
                </div>
              ) : inventoryData.movements.length === 0 ? (
                <div className="text-center py-20 glass rounded-3xl border-dashed"><p className="text-brand-muted">No hay movimientos de inventario en este mes.</p></div>
              ) : (
                <div className="space-y-3">
                  {inventoryData.movements.map((m) => (
                    <motion.div layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={m.id} className="group glass p-4 rounded-2xl flex items-center justify-between hover:border-brand-accent/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", m.type === 'in' ? "bg-brand-accent/10 text-brand-accent" : "bg-red-500/10 text-red-400")}>{m.type === 'in' ? <Plus size={20} /> : <Minus size={20} />}</div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {m.description}
                            {m.subtype && (
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded border uppercase font-bold",
                                m.subtype === 'venta' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-purple-500/10 border-purple-500/30 text-purple-400"
                              )}>
                                {m.subtype}
                              </span>
                            )}
                            {m.invoice_number && m.subtype !== 'regalia' && (
                              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-brand-muted">
                                {m.type === 'out' ? 'ORDEN' : 'FACT'}: {m.invoice_number}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-brand-muted">{format(new Date(m.date), 'dd MMM yyyy', { locale: es })}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className={cn("font-bold text-lg", m.type === 'in' ? "text-brand-accent" : "text-red-400")}>{m.type === 'in' ? '+' : '-'}{m.units} uds</div>
                        <button onClick={() => handleDeleteInventory(m.id)} className="p-2 text-brand-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(null)} className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md glass p-8 rounded-3xl shadow-2xl">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  {showForm === 'income' && <><Plus className="text-brand-accent" /> Nuevo Ingreso</>}
                  {showForm === 'expense' && <><Minus className="text-red-400" /> Nuevo Egreso</>}
                  {showForm === 'stock_in' && <><Plus className="text-brand-accent" /> Entrada Inventario</>}
                  {showForm === 'stock_out' && <><Minus className="text-red-400" /> Salida Inventario</>}
                </h2>
                {(showForm === 'income' || showForm === 'expense') ? (
                  <form onSubmit={handleAddTransaction} className="space-y-5">
                    <div><label className="block text-sm text-brand-muted mb-2">Descripción</label><input autoFocus type="text" required className="input-field w-full" placeholder="Ej: Pago de servicios" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                    <div><label className="block text-sm text-brand-muted mb-2">Monto</label><input type="number" required min="0" step="0.01" className="input-field w-full" placeholder="0.00" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} /></div>
                    <div><label className="block text-sm text-brand-muted mb-2">Fecha</label><div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" size={18} /><input type="date" required className="input-field w-full pl-12 pr-4" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div></div>
                    <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowForm(null)} className="flex-1 p-4 rounded-xl border border-brand-border hover:bg-white/5 transition-colors font-medium">Cancelar</button><button type="submit" className={cn("flex-1 p-4 rounded-xl font-bold transition-all active:scale-95", showForm === 'income' ? "bg-brand-accent text-brand-bg" : "bg-red-500 text-white")}>Guardar</button></div>
                  </form>
                ) : (
                  <form onSubmit={handleAddInventory} className="space-y-5">
                    <div>
                      <label className="block text-sm text-brand-muted mb-2">Descripción</label>
                      <input 
                        autoFocus
                        type="text"
                        required
                        className="input-field w-full"
                        placeholder="Ej: Venta a cliente X"
                        value={inventoryFormData.description}
                        onChange={e => setInventoryFormData({ ...inventoryFormData, description: e.target.value })}
                      />
                    </div>
                    
                    {showForm === 'stock_out' && (
                      <div>
                        <label className="block text-sm text-brand-muted mb-2">Tipo de Salida</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setInventoryFormData({ ...inventoryFormData, subtype: 'venta' })}
                            className={cn(
                              "p-3 rounded-xl border transition-all font-medium",
                              inventoryFormData.subtype === 'venta' ? "bg-blue-500/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-brand-muted"
                            )}
                          >
                            Venta
                          </button>
                          <button
                            type="button"
                            onClick={() => setInventoryFormData({ ...inventoryFormData, subtype: 'regalia', invoice_number: '' })}
                            className={cn(
                              "p-3 rounded-xl border transition-all font-medium",
                              inventoryFormData.subtype === 'regalia' ? "bg-purple-500/20 border-purple-500 text-purple-400" : "bg-white/5 border-white/10 text-brand-muted"
                            )}
                          >
                            Regalía
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-brand-muted mb-2">Unidades</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          className="input-field w-full"
                          placeholder="0"
                          value={inventoryFormData.units || ''}
                          onChange={e => setInventoryFormData({ ...inventoryFormData, units: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-brand-muted mb-2">
                          {inventoryFormData.type === 'out' 
                            ? (inventoryFormData.subtype === 'regalia' ? 'N° Orden (N/A)' : 'N° Orden') 
                            : 'N° Factura'}
                        </label>
                        <input 
                          type="text"
                          disabled={inventoryFormData.subtype === 'regalia'}
                          className={cn(
                            "input-field w-full",
                            inventoryFormData.subtype === 'regalia' && "opacity-50 cursor-not-allowed"
                          )}
                          placeholder={inventoryFormData.subtype === 'regalia' ? "No aplica" : (inventoryFormData.type === 'out' ? "N° de orden" : "N° de factura")}
                          value={inventoryFormData.invoice_number}
                          onChange={e => setInventoryFormData({ ...inventoryFormData, invoice_number: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-brand-muted mb-2">Fecha</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" size={18} />
                        <input 
                          type="date"
                          required
                          className="input-field w-full pl-12 pr-4"
                          value={inventoryFormData.date}
                          onChange={e => setInventoryFormData({ ...inventoryFormData, date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        type="button"
                        onClick={() => setShowForm(null)}
                        className="flex-1 p-4 rounded-xl border border-brand-border hover:bg-white/5 transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className={cn(
                          "flex-1 p-4 rounded-xl font-bold transition-all active:scale-95",
                          showForm === 'stock_in' ? "bg-brand-accent text-brand-bg" : "bg-red-500 text-white"
                        )}
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
