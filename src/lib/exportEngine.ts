import jsPDF from 'jspdf';
import { Journal, TradeRecord } from '../types';
import { decryptData, getPassword, setPassword } from './crypto';

export type ExportFormat = 'pdf' | 'markdown' | 'json';
export type DateRangePreset = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom';
export type ContentScope = 'all' | 'journals_only' | 'trades_only';

export interface ExportOptions {
  format: ExportFormat;
  dateRange: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  contentScope: ContentScope;
  passphrase?: string;
}

export interface ExportProgressCallback {
  (progress: number, status: string): void;
}

export interface FilteredDataResult {
  journals: Journal[];
  trades: TradeRecord[];
  totalPnL: number;
  hasEncryptedEntries: boolean;
  startDateText: string;
  endDateText: string;
}

// 1. Calculate time boundaries based on selected range
export const calculateDateBounds = (
  range: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { startTime: number; endTime: number; startText: string; endText: string } => {
  const now = new Date();
  const endTime = now.getTime();
  let startTime = 0;

  if (range === '7d') {
    startTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  } else if (range === '30d') {
    startTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  } else if (range === '90d') {
    startTime = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  } else if (range === 'ytd') {
    startTime = new Date(now.getFullYear(), 0, 1).getTime();
  } else if (range === 'all') {
    startTime = 0;
  } else if (range === 'custom') {
    if (customStart) {
      startTime = new Date(customStart).getTime();
    }
    if (customEnd) {
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      return {
        startTime: startTime || 0,
        endTime: end.getTime(),
        startText: customStart || 'Beginning',
        endText: customEnd || 'Present'
      };
    }
  }

  const startText = startTime > 0 ? new Date(startTime).toLocaleDateString() : 'All Time';
  const endText = new Date(endTime).toLocaleDateString();

  return { startTime, endTime, startText, endText };
};

// 2. Filter journals and trades according to options
export const filterExportData = (
  journals: Journal[],
  trades: TradeRecord[],
  options: ExportOptions
): FilteredDataResult => {
  const { startTime, endTime, startText, endText } = calculateDateBounds(
    options.dateRange,
    options.customStartDate,
    options.customEndDate
  );

  let filteredJournals: Journal[] = [];
  if (options.contentScope !== 'trades_only') {
    filteredJournals = journals.filter(j => {
      const t = j.createdAt || 0;
      return t >= startTime && t <= endTime;
    });
  }

  let filteredTrades: TradeRecord[] = [];
  if (options.contentScope !== 'journals_only') {
    filteredTrades = trades.filter(t => {
      const time = t.timestamp || 0;
      return time >= startTime && time <= endTime;
    });
  }

  // Sort newest to oldest
  filteredJournals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  filteredTrades.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const totalPnL = filteredTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
  const hasEncryptedEntries = filteredJournals.some(j => !!j.encryptedPayload);

  return {
    journals: filteredJournals,
    trades: filteredTrades,
    totalPnL,
    hasEncryptedEntries,
    startDateText: startText,
    endDateText: endText
  };
};

// 3. Decrypt protected journals
export const decryptJournalsForExport = async (
  journals: Journal[],
  passphrase?: string
): Promise<{ decryptedJournals: Journal[]; success: boolean; error?: string }> => {
  const key = passphrase || getPassword();
  if (!key) {
    return {
      decryptedJournals: journals,
      success: false,
      error: 'Passphrase is required to unlock encrypted entries.'
    };
  }

  const processed: Journal[] = [];

  for (const j of journals) {
    if (j.encryptedPayload) {
      try {
        const decrypted = await decryptData(j.encryptedPayload, key);
        processed.push({ ...j, ...decrypted });
      } catch (err) {
        console.error('Failed to decrypt entry:', j.id, err);
        return {
          decryptedJournals: journals,
          success: false,
          error: 'Incorrect passphrase. Could not decrypt protected entries.'
        };
      }
    } else {
      processed.push(j);
    }
  }

  // Store valid password in memory session for subsequent calls
  setPassword(key);

  return {
    decryptedJournals: processed,
    success: true
  };
};

// 4. Client-side Blob download trigger
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================================================
// PDF EXPORT ENGINE (jsPDF)
// ============================================================================
export const generateAuditTrailPDF = async (
  data: FilteredDataResult,
  userMetadata: { name: string; email: string },
  onProgress?: ExportProgressCallback
): Promise<void> => {
  onProgress?.(70, 'Compiling PDF document layout...');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper: check page break
  const checkPageBreak = (spaceNeeded: number) => {
    if (y + spaceNeeded > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 140);
    doc.text('Lumina Personal Audit Trail • Confidential', margin, 10);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin, 10, { align: 'right' });
    doc.setDrawColor(220, 220, 230);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  // 1. Cover / Title Banner
  drawHeader();
  y += 5;

  doc.setFillColor(109, 40, 217); // Violet-700
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('LUMINA AUDIT TRAIL & REVIEW REPORT', margin + 6, y + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(230, 230, 255);
  doc.text(
    `Prepared for: ${userMetadata.name || userMetadata.email || 'Lumina Member'}  •  Date Range: ${data.startDateText} - ${data.endDateText}`,
    margin + 6,
    y + 18
  );

  y += 30;

  // 2. Executive Summary Metrics Box
  doc.setFillColor(248, 249, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('SUMMARY STATISTICS', margin + 6, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  const statsText = [
    `Journal Entries: ${data.journals.length}`,
    `Total Trades Logged: ${data.trades.length}`,
    `Net Realized PnL: $${data.totalPnL.toFixed(2)}`,
    `Generated: ${new Date().toLocaleString()}`
  ];

  const colWidth = contentWidth / 4;
  statsText.forEach((text, i) => {
    doc.text(text, margin + 6 + i * colWidth, y + 15);
  });

  y += 28;

  // 3. Section: Trading Audit Log
  if (data.trades.length > 0) {
    checkPageBreak(30);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text(`1. Trading Logs & Performance Review (${data.trades.length} trades)`, margin, y);
    y += 6;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);

    doc.text('Date', margin + 2, y + 5);
    doc.text('Symbol', margin + 26, y + 5);
    doc.text('Action', margin + 46, y + 5);
    doc.text('PnL ($)', margin + 66, y + 5);
    doc.text('Emotion State', margin + 92, y + 5);
    doc.text('Revenge?', margin + 125, y + 5);
    doc.text('Notes / Reflection', margin + 145, y + 5);

    y += 8;

    data.trades.forEach((trade) => {
      checkPageBreak(10);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const dateStr = trade.timestamp ? new Date(trade.timestamp).toLocaleDateString() : '-';
      const pnlNum = Number(trade.pnl) || 0;
      const pnlStr = (pnlNum >= 0 ? '+$' : '-$') + Math.abs(pnlNum).toFixed(2);

      doc.text(dateStr, margin + 2, y + 4);
      doc.text(trade.symbol || '-', margin + 26, y + 4);

      // Action color
      if (trade.action === 'BUY') {
        doc.setTextColor(16, 149, 193);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.text(trade.action || '-', margin + 46, y + 4);

      // PnL color
      if (pnlNum >= 0) {
        doc.setTextColor(22, 163, 74);
      } else {
        doc.setTextColor(220, 38, 38);
      }
      doc.text(pnlStr, margin + 66, y + 4);

      doc.setTextColor(71, 85, 105);
      doc.text(trade.associatedEmotion || 'Neutral', margin + 92, y + 4);

      if (trade.isRevengeTrade) {
        doc.setTextColor(220, 38, 38);
        doc.text('YES', margin + 125, y + 4);
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('No', margin + 125, y + 4);
      }

      doc.setTextColor(100, 116, 139);
      const noteSnippet = doc.splitTextToSize(trade.notes || '-', 32);
      doc.text(noteSnippet[0] || '-', margin + 145, y + 4);

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 6, margin + contentWidth, y + 6);

      y += 7;
    });

    y += 8;
  }

  // 4. Section: Journal Reflections & Cognitive Audit
  if (data.journals.length > 0) {
    checkPageBreak(35);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text(`2. Journal Reflections & Cognitive Insights (${data.journals.length} entries)`, margin, y);
    y += 8;

    data.journals.forEach((entry, idx) => {
      checkPageBreak(40);

      // Entry Container
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(229, 231, 235);

      const entryDate = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '';
      const entryTitle = entry.title || 'Untitled Journal Entry';

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(`${idx + 1}. ${entryTitle}`, margin, y);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(entryDate, pageWidth - margin, y, { align: 'right' });
      y += 5;

      // Summary
      if (entry.summary) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(55, 65, 81);
        const summaryLines = doc.splitTextToSize(`Summary: ${entry.summary}`, contentWidth - 4);
        doc.text(summaryLines, margin + 2, y);
        y += summaryLines.length * 4 + 2;
      }

      // Emotions & CBT Insights
      const emotionsList = (entry.emotions || []).map(e => e.name).join(', ');
      const distortionsList = (entry.cbtDistortions || []).map(d => d.type).join(', ');

      if (emotionsList || distortionsList) {
        checkPageBreak(12);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(79, 70, 229);

        let badgeStr = '';
        if (emotionsList) badgeStr += `Emotions: ${emotionsList}  `;
        if (distortionsList) badgeStr += `• CBT Distortions Identified: ${distortionsList}`;

        doc.text(badgeStr, margin + 2, y);
        y += 5;
      }

      // Messages / Dialogue Snippets
      if (entry.messages && entry.messages.length > 0) {
        checkPageBreak(25);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(75, 85, 99);
        doc.text('Key Dialogue & AI Feedback:', margin + 2, y);
        y += 4;

        entry.messages.slice(0, 6).forEach(m => {
          checkPageBreak(12);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', m.role === 'user' ? 'bold' : 'italic');
          doc.setTextColor(m.role === 'user' ? 30 : 109, m.role === 'user' ? 41 : 40, m.role === 'user' ? 59 : 217);

          const speaker = m.role === 'user' ? 'You' : 'Lumina AI';
          const msgLines = doc.splitTextToSize(`${speaker}: ${m.content}`, contentWidth - 8);
          doc.text(msgLines, margin + 4, y);
          y += msgLines.length * 3.5 + 1.5;
        });
      }

      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y + 2, margin + contentWidth, y + 2);
      y += 8;
    });
  }

  // Page Numbers Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  onProgress?.(95, 'Preparing PDF file for download...');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`lumina-audit-trail-${dateStr}.pdf`);
  onProgress?.(100, 'Download complete!');
};

// ============================================================================
// MARKDOWN EXPORT ENGINE (.md)
// ============================================================================
export const generateAuditTrailMarkdown = async (
  data: FilteredDataResult,
  userMetadata: { name: string; email: string },
  onProgress?: ExportProgressCallback
): Promise<void> => {
  onProgress?.(70, 'Building Markdown backup file...');

  let md = '';

  // YAML Frontmatter
  md += `---\n`;
  md += `title: "Lumina Audit Trail & Personal Review"\n`;
  md += `export_date: "${new Date().toISOString()}"\n`;
  md += `user: "${userMetadata.name || userMetadata.email || 'Lumina Member'}"\n`;
  md += `date_range: "${data.startDateText} - ${data.endDateText}"\n`;
  md += `total_journals: ${data.journals.length}\n`;
  md += `total_trades: ${data.trades.length}\n`;
  md += `net_pnl: ${data.totalPnL.toFixed(2)}\n`;
  md += `---\n\n`;

  md += `# Lumina Audit Trail & Comprehensive Review\n\n`;
  md += `> **Audit Scope**: ${data.startDateText} to ${data.endDateText}\n`;
  md += `> **Total Journal Entries**: ${data.journals.length} | **Total Trades**: ${data.trades.length} | **Net Realized PnL**: $${data.totalPnL.toFixed(2)}\n\n`;

  // Trading Logs Section
  if (data.trades.length > 0) {
    md += `## 1. Trading Logs & Performance Review\n\n`;
    md += `| Date | Symbol | Action | PnL ($) | Associated Emotion | Revenge Trade? | Notes |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    data.trades.forEach(t => {
      const d = t.timestamp ? new Date(t.timestamp).toLocaleDateString() : '-';
      const pnlStr = (Number(t.pnl) >= 0 ? '+$' : '-$') + Math.abs(Number(t.pnl) || 0).toFixed(2);
      const revenge = t.isRevengeTrade ? '⚠️ YES' : 'No';
      const cleanNotes = (t.notes || '-').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      md += `| ${d} | **${t.symbol}** | ${t.action} | ${pnlStr} | ${t.associatedEmotion || 'Neutral'} | ${revenge} | ${cleanNotes} |\n`;
    });

    md += `\n---\n\n`;
  }

  // Journals Section
  if (data.journals.length > 0) {
    md += `## 2. Journal Reflections & Cognitive Logs\n\n`;

    data.journals.forEach((j, idx) => {
      const d = j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '-';
      md += `### ${idx + 1}. ${j.title || 'Untitled Reflection'} (${d})\n\n`;

      if (j.summary) {
        md += `> ${j.summary}\n\n`;
      }

      if (j.emotions && j.emotions.length > 0) {
        md += `**Emotions Detected**: ${j.emotions.map(e => `\`${e.name}\``).join(' ')}\n\n`;
      }

      if (j.cbtDistortions && j.cbtDistortions.length > 0) {
        md += `**Cognitive Distortions Identified**:\n`;
        j.cbtDistortions.forEach(dist => {
          md += `- **${dist.type}**: ${dist.evidence}${dist.reframePrompt ? ` *(Reframe: ${dist.reframePrompt})*` : ''}\n`;
        });
        md += `\n`;
      }

      if (j.messages && j.messages.length > 0) {
        md += `#### Dialogue Transcript\n\n`;
        j.messages.forEach(m => {
          const speaker = m.role === 'user' ? `**You**` : `**Lumina AI**`;
          md += `${speaker}: ${m.content}\n\n`;
        });
      }

      md += `---\n\n`;
    });
  }

  onProgress?.(90, 'Preparing Markdown download...');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `lumina-audit-trail-${dateStr}.md`);
  onProgress?.(100, 'Download complete!');
};

// ============================================================================
// MACHINE-READABLE JSON EXPORT ENGINE (.json)
// ============================================================================
export const generateAuditTrailJSON = async (
  data: FilteredDataResult,
  userMetadata: { name: string; email: string },
  onProgress?: ExportProgressCallback
): Promise<void> => {
  onProgress?.(70, 'Building structured JSON archive...');

  const payload = {
    schemaVersion: '1.0',
    exportTimestamp: Date.now(),
    exportDateFormatted: new Date().toISOString(),
    user: {
      displayName: userMetadata.name || '',
      email: userMetadata.email || ''
    },
    filterOptions: {
      startDate: data.startDateText,
      endDate: data.endDateText
    },
    auditSummary: {
      totalJournals: data.journals.length,
      totalTrades: data.trades.length,
      netRealizedPnL: data.totalPnL
    },
    tradingLogs: data.trades,
    journalEntries: data.journals
  };

  onProgress?.(90, 'Preparing JSON download...');
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `lumina-audit-trail-${dateStr}.json`);
  onProgress?.(100, 'Download complete!');
};
