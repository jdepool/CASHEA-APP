import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { normalizeNumber } from "@shared/numberUtils";

// Normalize header for flexible matching
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[#\s]+/g, '') // Remove # and spaces
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, ''); // Remove accent marks
}

/**
 * Verify if a payment record exists in bank statements
 * Returns 'SI' (verified), 'NO' (not verified)
 */
function verifyPaymentInBankStatement(
  paymentRecord: any,
  bankStatementRows: any[],
  bankStatementHeaders: string[]
): string {
  // If no bank statements available, return "NO"
  if (!bankStatementRows || bankStatementRows.length === 0) {
    return 'NO';
  }

  const paymentRef = paymentRecord['# Referencia'] || paymentRecord['#Referencia'] || paymentRecord['Referencia'];
  const paymentAmountVES = paymentRecord['Monto Pagado en VES'] || paymentRecord['Monto pagado en VES'];
  const paymentAmountUSD = paymentRecord['Monto Pagado en USD'] || paymentRecord['Monto pagado en USD'];

  // If no reference or amounts, can't verify
  if (!paymentRef || (!paymentAmountVES && !paymentAmountUSD)) {
    return 'NO';
  }

  // Find relevant headers in bank statement (case-insensitive)
  const referenciaHeader = bankStatementHeaders.find(h => 
    String(h).toLowerCase().includes('referencia')
  );
  const debeHeader = bankStatementHeaders.find(h => 
    String(h).toLowerCase().includes('debe')
  );
  const haberHeader = bankStatementHeaders.find(h => 
    String(h).toLowerCase().includes('haber')
  );

  // Normalize payment reference (remove spaces, leading zeros, and quotes)
  const normalizedPaymentRef = String(paymentRef)
    .replace(/^["']|["']$/g, '') // Remove leading/trailing quotes
    .replace(/\s+/g, '')         // Remove spaces
    .replace(/^0+/, '')           // Remove leading zeros
    .toLowerCase();

  // Normalize payment amounts
  const normalizedVES = paymentAmountVES ? normalizeNumber(paymentAmountVES) : null;
  const normalizedUSD = paymentAmountUSD ? normalizeNumber(paymentAmountUSD) : null;

  // Search bank statements for matching reference and amount
  const found = bankStatementRows.some(bankRow => {
    // Check reference match
    if (referenciaHeader) {
      const bankRef = bankRow[referenciaHeader];
      if (bankRef) {
        const normalizedBankRef = String(bankRef)
          .replace(/^["']|["']$/g, '') // Remove leading/trailing quotes
          .replace(/\s+/g, '')         // Remove spaces
          .replace(/^0+/, '')           // Remove leading zeros
          .toLowerCase();
        
        // If references don't match, skip this bank row
        if (normalizedBankRef !== normalizedPaymentRef) {
          return false;
        }

        // References match - now check amount in either Debe or Haber
        let amountMatches = false;

        // Check Debe column
        if (debeHeader && bankRow[debeHeader]) {
          const bankDebe = normalizeNumber(bankRow[debeHeader]);
          if (!isNaN(bankDebe)) {
            // Compare with VES
            if (normalizedVES !== null && Math.abs(bankDebe - normalizedVES) < 0.01) {
              amountMatches = true;
            }
            // Compare with USD
            if (normalizedUSD !== null && Math.abs(bankDebe - normalizedUSD) < 0.01) {
              amountMatches = true;
            }
          }
        }

        // Check Haber column
        if (haberHeader && bankRow[haberHeader]) {
          const bankHaber = normalizeNumber(bankRow[haberHeader]);
          if (!isNaN(bankHaber)) {
            // Compare with VES
            if (normalizedVES !== null && Math.abs(bankHaber - normalizedVES) < 0.01) {
              amountMatches = true;
            }
            // Compare with USD
            if (normalizedUSD !== null && Math.abs(bankHaber - normalizedUSD) < 0.01) {
              amountMatches = true;
            }
          }
        }

        return amountMatches;
      }
    }
    return false;
  });

  return found ? 'SI' : 'NO';
}

const uploadStorage = multer.memoryStorage();
const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/upload-payment-records', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: 'El archivo es demasiado grande. Tamaño máximo: 10MB' 
            });
          }
          return res.status(400).json({ 
            error: `Error al cargar el archivo: ${err.message}` 
          });
        }
        return res.status(400).json({ 
          error: err.message || 'Solo se permiten archivos Excel (.xlsx, .xls)' 
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No se proporcionó ningún archivo' 
        });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel no contiene hojas de cálculo'
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        return res.status(400).json({
          error: 'No se pudo leer la hoja de cálculo'
        });
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as any[][];

      if (jsonData.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel está vacío'
        });
      }

      const allHeaders = jsonData[0] as string[];
      
      if (!allHeaders || allHeaders.length === 0) {
        return res.status(400).json({
          error: 'El archivo no contiene encabezados válidos'
        });
      }

      // Validate this is a payment records file, not an orders file
      const headersLower = allHeaders.map(h => h.toLowerCase());
      const hasPaymentHeaders = headersLower.some(h => 
        h.includes('fecha') && h.includes('transac')
      ) || headersLower.some(h => 
        h.includes('#') && h.includes('orden')
      ) || headersLower.some(h => 
        h.includes('#') && h.includes('cuota') && h.includes('pagada')
      );
      
      const hasOrderHeaders = headersLower.some(h => 
        h.includes('cuota 1') || h.includes('cuota 2') || h.includes('cuota 3')
      ) || headersLower.some(h => 
        h.includes('venta') && h.includes('total')
      );

      if (!hasPaymentHeaders) {
        return res.status(400).json({
          error: 'Este archivo no parece ser un archivo de pagos. Por favor, asegúrese de cargar el archivo correcto en la zona de "Pago de Cuotas".'
        });
      }

      if (hasOrderHeaders) {
        return res.status(400).json({
          error: 'Este parece ser un archivo de órdenes, no de pagos. Por favor, cárguelo en la zona de "Órdenes y Cuotas".'
        });
      }

      // Use all headers from the file as-is
      const rows = jsonData.slice(1).map(row => {
        const rowObj: any = {};
        allHeaders.forEach((header, idx) => {
          rowObj[header] = (row[idx] !== undefined) ? row[idx] : "";
        });
        return rowObj;
      }).filter(row => {
        // Filter out empty rows (rows without critical fields)
        const orden = row['# Orden'];
        return orden != null && orden !== '' && String(orden).trim() !== '';
      });

      console.log(`Filtered ${jsonData.length - 1 - rows.length} empty rows from payment records`);
      console.log('Payment records processed:', {
        fileName: req.file.originalname,
        headers: allHeaders,
        totalRows: jsonData.length - 1,
        rowCount: rows.length,
        firstRow: rows[0]
      });

      // Fetch bank statements to calculate VERIFICACION
      const latestBankStatement = await storage.getLatestBankStatement();
      const bankStatementRows = latestBankStatement?.rows || [];
      const bankStatementHeaders = latestBankStatement?.headers || [];

      if (bankStatementRows.length === 0) {
        console.log('⚠️  WARNING: No bank statements found. All payments will have VERIFICACION = "NO"');
        console.log('   Please upload bank statements FIRST, then re-upload payment records for verification');
      } else {
        console.log(`✓ Found ${bankStatementRows.length} bank statement rows for verification`);
      }

      // Add VERIFICACION field to each payment row
      const enrichedRows = rows.map(row => {
        const verificacion = verifyPaymentInBankStatement(row, bankStatementRows, bankStatementHeaders);
        return {
          ...row,
          VERIFICACION: verificacion
        };
      });

      // Count verification results
      const verifiedCount = enrichedRows.filter(r => r.VERIFICACION === 'SI').length;
      const notVerifiedCount = enrichedRows.filter(r => r.VERIFICACION === 'NO').length;
      
      console.log(`Payment verification complete: ${verifiedCount} verified (SI), ${notVerifiedCount} not verified (NO)`);

      // Include VERIFICACION in headers
      const enrichedHeaders = [...allHeaders, 'VERIFICACION'];

      // Merge with existing payment records (skip duplicates by Orden + Cuota)
      const mergeResult = await storage.mergePaymentRecords(enrichedRows, req.file.originalname, enrichedHeaders);

      // Log summary of the merge operation
      console.log('\n=== RESUMEN DE CARGA DE PAGOS ===');
      console.log(`Archivo: ${req.file.originalname}`);
      console.log(`Registros en archivo: ${rows.length}`);
      console.log(`Nuevos agregados: ${mergeResult.added}`);
      console.log(`Actualizados: ${mergeResult.updated}`);
      console.log(`Omitidos: ${mergeResult.skipped}`);
      console.log(`Total en base de datos: ${mergeResult.total}`);
      if (mergeResult.skipped > 0 && mergeResult.skippedRecords) {
        console.log(`\nDetalle: Ver arriba los ${mergeResult.skippedRecords.length} registros omitidos`);
      }
      console.log('==================================\n');

      res.json({
        success: true,
        data: {
          headers: enrichedHeaders,
          rows: enrichedRows,
          fileName: req.file.originalname,
          rowCount: enrichedRows.length,
        },
        merge: {
          added: mergeResult.added,
          updated: mergeResult.updated,
          skipped: mergeResult.skipped,
          total: mergeResult.total,
          message: `${mergeResult.added} nuevos, ${mergeResult.updated} actualizados, ${mergeResult.skipped} omitidos. Total: ${mergeResult.total} pagos.`
        }
      });
    } catch (error) {
      console.error('Error processing payment records file:', error);
      res.status(500).json({
        error: 'Error al procesar el archivo de pagos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  app.post('/api/upload-excel', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: 'El archivo es demasiado grande. Tamaño máximo: 10MB' 
            });
          }
          return res.status(400).json({ 
            error: `Error al cargar el archivo: ${err.message}` 
          });
        }
        return res.status(400).json({ 
          error: err.message || 'Solo se permiten archivos Excel (.xlsx, .xls)' 
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No se proporcionó ningún archivo' 
        });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel no contiene hojas de cálculo'
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        return res.status(400).json({
          error: 'No se pudo leer la hoja de cálculo'
        });
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as any[][];

      if (jsonData.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel está vacío'
        });
      }

      const allHeaders = jsonData[0] as string[];
      
      if (!allHeaders || allHeaders.length === 0) {
        return res.status(400).json({
          error: 'El archivo no contiene encabezados válidos'
        });
      }

      // Validate this is an orders file, not a payment records file
      const headersLower = allHeaders.map(h => h.toLowerCase());
      const hasOrderHeaders = headersLower.some(h => 
        h.includes('orden') && !h.includes('#')
      ) && (headersLower.some(h => 
        h.includes('venta') && h.includes('total')
      ) || headersLower.some(h => 
        h.includes('cuota 1') || h.includes('cuota 2')
      ));
      
      const hasPaymentHeaders = headersLower.some(h => 
        h.includes('fecha') && h.includes('transac')
      ) || headersLower.some(h => 
        h.includes('#') && h.includes('cuota') && h.includes('pagada')
      );

      if (!hasOrderHeaders) {
        return res.status(400).json({
          error: 'Este archivo no parece ser un archivo de órdenes. Por favor, asegúrese de cargar el archivo correcto en la zona de "Órdenes y Cuotas".'
        });
      }

      if (hasPaymentHeaders) {
        return res.status(400).json({
          error: 'Este parece ser un archivo de pagos, no de órdenes. Por favor, cárguelo en la zona de "Pago de Cuotas".'
        });
      }

      console.log('=== EXCEL FILE HEADERS ===');
      console.log('Total headers in Excel:', allHeaders.length);
      console.log('First 10 headers:', allHeaders.slice(0, 10));
      console.log('Headers containing "Nombre":', allHeaders.filter(h => h.toLowerCase().includes('nombre')));
      console.log('Headers containing "Venta":', allHeaders.filter(h => h.toLowerCase().includes('venta')));
      console.log('Headers containing "Cuota 1":', allHeaders.filter(h => h.includes('1')).slice(0, 5));

      // Map output header names to possible input header names
      const headerMapping: { [key: string]: string[] } = {
        "PAGO INICIAL": ["Pago en Caja", "Pago en caja", "PAGO EN CAJA"],
        "NUMERO DE CUOTAS": ["Tipo orden", "Tipo Orden", "TIPO ORDEN"],
        "STATUS ORDEN": ["Estado Orden", "Estado orden", "ESTADO ORDEN"],
      };

      const requiredHeaders = [
        "Orden",
        "Nombre del comprador",
        "STATUS ORDEN",
        "Venta total",
        "Fecha de compra",
        "NUMERO DE CUOTAS",
        "PAGO INICIAL",
        "Estado pago inicial",
        "Fecha cuota 1", "Cuota 1", "Pagado de cuota 1", "Estado cuota 1", "Fecha de pago cuota 1",
        "Fecha cuota 2", "Cuota 2", "Pagado de cuota 2", "Estado cuota 2", "Fecha de pago cuota 2",
        "Fecha cuota 3", "Cuota 3", "Pagado de cuota 3", "Estado cuota 3", "Fecha de pago cuota 3",
        "Fecha cuota 4", "Cuota 4", "Pagado de cuota 4", "Estado cuota 4", "Fecha de pago cuota 4",
        "Fecha cuota 5", "Cuota 5", "Pagado de cuota 5", "Estado cuota 5", "Fecha de pago cuota 5",
        "Fecha cuota 6", "Cuota 6", "Pagado de cuota 6", "Estado cuota 6", "Fecha de pago cuota 6",
        "Fecha cuota 7", "Cuota 7", "Pagado de cuota 7", "Estado cuota 7", "Fecha de pago cuota 7",
        "Fecha cuota 8", "Cuota 8", "Pagado de cuota 8", "Estado cuota 8", "Fecha de pago cuota 8",
        "Fecha cuota 9", "Cuota 9", "Pagado de cuota 9", "Estado cuota 9", "Fecha de pago cuota 9",
        "Fecha cuota 10", "Cuota 10", "Pagado de cuota 10", "Estado cuota 10", "Fecha de pago cuota 10",
        "Fecha cuota 11", "Cuota 11", "Pagado de cuota 11", "Estado cuota 11", "Fecha de pago cuota 11",
        "Fecha cuota 12", "Cuota 12", "Pagado de cuota 12", "Estado cuota 12", "Fecha de pago cuota 12",
        "Fecha cuota 13", "Cuota 13", "Pagado de cuota 13", "Estado cuota 13", "Fecha de pago cuota 13",
        "Fecha cuota 14", "Cuota 14", "Pagado de cuota 14", "Estado cuota 14", "Fecha de pago cuota 14"
      ];

      // Create normalized header map for flexible matching
      // Use first match if multiple headers normalize to the same value
      const normalizedHeaderMap = new Map<string, {actualHeader: string, index: number}>();
      const seenNormalized = new Set<string>();
      
      allHeaders.forEach((header, idx) => {
        const normalized = normalizeHeader(header);
        
        // Only store first occurrence of each normalized header
        if (!seenNormalized.has(normalized)) {
          normalizedHeaderMap.set(normalized, {actualHeader: header, index: idx});
          seenNormalized.add(normalized);
        } else {
          console.warn(`Duplicate normalized header detected: "${header}" normalizes to "${normalized}" (skipping duplicate)`);
        }
      });

      // Log matching results
      console.log('=== HEADER MATCHING RESULTS ===');
      const matchedHeaders: string[] = [];
      const unmatchedHeaders: string[] = [];
      
      requiredHeaders.forEach(header => {
        const normalized = normalizeHeader(header);
        const headerInfo = normalizedHeaderMap.get(normalized);
        if (headerInfo) {
          matchedHeaders.push(header);
        } else {
          unmatchedHeaders.push(header);
        }
      });
      
      console.log(`Matched ${matchedHeaders.length} of ${requiredHeaders.length} headers`);
      console.log('Matched headers:', matchedHeaders.slice(0, 10));
      console.log('Unmatched headers:', unmatchedHeaders.slice(0, 10));

      const rows = jsonData.slice(1).map(row => {
        const rowObj: any = {};
        requiredHeaders.forEach(header => {
          let headerInfo = normalizedHeaderMap.get(normalizeHeader(header));
          
          // If not found and header has mapping alternatives, try those
          if (!headerInfo && headerMapping[header]) {
            for (const alternative of headerMapping[header]) {
              headerInfo = normalizedHeaderMap.get(normalizeHeader(alternative));
              if (headerInfo) break;
            }
          }
          
          if (headerInfo) {
            // Use the standardized header name as key, value from matched Excel column
            rowObj[header] = (row[headerInfo.index] !== undefined) ? row[headerInfo.index] : "";
          } else {
            // Header not found in Excel, set empty string
            rowObj[header] = "";
          }
        });
        return rowObj;
      }).filter(row => {
        // Filter out empty rows (rows without an Orden number)
        const orden = row['Orden'];
        return orden != null && orden !== '' && String(orden).trim() !== '';
      });

      console.log(`Filtered ${jsonData.length - 1 - rows.length} empty rows from Excel data`);
      console.log(`Processing ${rows.length} valid order rows`);

      // Merge with existing orders (upsert by Orden)
      const mergeResult = await storage.mergeOrders(rows, req.file.originalname, requiredHeaders);

      res.json({
        success: true,
        data: {
          headers: requiredHeaders,
          rows,
          fileName: req.file.originalname,
          rowCount: rows.length,
        },
        merge: {
          added: mergeResult.added,
          updated: mergeResult.updated,
          total: mergeResult.total,
          message: `${mergeResult.added} nuevas órdenes agregadas, ${mergeResult.updated} órdenes actualizadas. Total: ${mergeResult.total} órdenes.`
        }
      });
    } catch (error) {
      console.error('Error processing Excel file:', error);
      res.status(500).json({
        error: 'Error al procesar el archivo Excel',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // GET endpoint to retrieve latest order data
  app.get('/api/orders', async (req, res) => {
    try {
      const latestOrder = await storage.getLatestOrder();
      
      if (!latestOrder) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: {
          headers: latestOrder.headers,
          rows: latestOrder.rows,
          fileName: latestOrder.fileName,
          rowCount: parseInt(latestOrder.rowCount, 10),
        }
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({
        error: 'Error al obtener las órdenes',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // GET endpoint to retrieve latest payment records
  app.get('/api/payment-records', async (req, res) => {
    try {
      const latestPaymentRecord = await storage.getLatestPaymentRecord();
      
      if (!latestPaymentRecord) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: {
          headers: latestPaymentRecord.headers,
          rows: latestPaymentRecord.rows,
          fileName: latestPaymentRecord.fileName,
          rowCount: parseInt(latestPaymentRecord.rowCount, 10),
        }
      });
    } catch (error) {
      console.error('Error fetching payment records:', error);
      res.status(500).json({
        error: 'Error al obtener los registros de pagos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // POST endpoint for marketplace orders upload
  app.post('/api/upload-marketplace-orders', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: 'El archivo es demasiado grande. Tamaño máximo: 10MB' 
            });
          }
          return res.status(400).json({ 
            error: `Error al cargar el archivo: ${err.message}` 
          });
        }
        return res.status(400).json({ 
          error: err.message || 'Solo se permiten archivos Excel (.xlsx, .xls)' 
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No se proporcionó ningún archivo' 
        });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel no contiene hojas de cálculo'
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      if (data.length < 2) {
        return res.status(400).json({
          error: 'El archivo no contiene datos suficientes'
        });
      }

      const allHeaders: string[] = data[0].map((h: any) => String(h || '').trim()).filter((h: string) => h !== '');
      
      if (allHeaders.length === 0) {
        return res.status(400).json({
          error: 'No se encontraron encabezados válidos en el archivo'
        });
      }

      // Process rows (skip header row)
      const rows: any[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowObj: any = {};
        
        allHeaders.forEach((header, index) => {
          rowObj[header] = (row[index] !== undefined) ? row[index] : "";
        });
        
        rows.push(rowObj);
      }

      // Check for duplicate order numbers and auto-deduplicate
      const orderNumberHeader = allHeaders.find(h => 
        h.toLowerCase().includes('orden') || 
        h.toLowerCase().includes('order')
      );
      
      let deduplicatedRows = rows;
      let duplicateWarning = '';
      
      if (orderNumberHeader) {
        const orderNumbersSeen = new Set<string>();
        const duplicatesFound: { orderNum: string; count: number }[] = [];
        const duplicateCounts = new Map<string, number>();
        
        // Track duplicates
        rows.forEach((row) => {
          const orderNum = String(row[orderNumberHeader] || '').trim();
          if (orderNum) {
            duplicateCounts.set(orderNum, (duplicateCounts.get(orderNum) || 0) + 1);
          }
        });
        
        // Find which orders have duplicates
        duplicateCounts.forEach((count, orderNum) => {
          if (count > 1) {
            duplicatesFound.push({ orderNum, count });
          }
        });
        
        // Keep only first occurrence of each order number
        deduplicatedRows = rows.filter((row) => {
          const orderNum = String(row[orderNumberHeader] || '').trim();
          if (!orderNum) return true; // Keep rows without order numbers
          
          if (orderNumbersSeen.has(orderNum)) {
            return false; // Skip duplicate
          }
          
          orderNumbersSeen.add(orderNum);
          return true; // Keep first occurrence
        });
        
        if (duplicatesFound.length > 0) {
          const totalRemoved = rows.length - deduplicatedRows.length;
          const duplicateDetails = duplicatesFound
            .slice(0, 5)
            .map(d => `${d.orderNum} (${d.count}x)`)
            .join(', ');
          
          const moreCount = duplicatesFound.length > 5 ? ` y ${duplicatesFound.length - 5} órdenes más` : '';
          
          duplicateWarning = `Se eliminaron ${totalRemoved} filas duplicadas. Órdenes duplicadas: ${duplicateDetails}${moreCount}`;
        }
      }

      // Save to database
      await storage.createMarketplaceOrder({
        fileName: req.file.originalname,
        headers: allHeaders,
        rows: deduplicatedRows,
        rowCount: String(deduplicatedRows.length),
      });

      const successMessage = `${deduplicatedRows.length} registros de marketplace cargados exitosamente.`;
      const fullMessage = duplicateWarning ? `${successMessage} ${duplicateWarning}` : successMessage;

      res.json({
        success: true,
        data: {
          headers: allHeaders,
          rows: deduplicatedRows,
          fileName: req.file.originalname,
          rowCount: deduplicatedRows.length,
        },
        message: fullMessage
      });
    } catch (error) {
      console.error('Error processing marketplace orders file:', error);
      res.status(500).json({
        error: 'Error al procesar el archivo de órdenes de marketplace',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // GET endpoint to retrieve latest marketplace orders
  app.get('/api/marketplace-orders', async (req, res) => {
    try {
      const latestMarketplaceOrder = await storage.getLatestMarketplaceOrder();
      
      if (!latestMarketplaceOrder) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: {
          headers: latestMarketplaceOrder.headers,
          rows: latestMarketplaceOrder.rows,
          fileName: latestMarketplaceOrder.fileName,
          rowCount: parseInt(latestMarketplaceOrder.rowCount, 10),
        }
      });
    } catch (error) {
      console.error('Error fetching marketplace orders:', error);
      res.status(500).json({
        error: 'Error al obtener las órdenes de marketplace',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // POST endpoint to upload bank statements
  app.post('/api/upload-bank-statement', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: 'El archivo es demasiado grande. Tamaño máximo: 10MB' 
            });
          }
          return res.status(400).json({ 
            error: `Error al cargar el archivo: ${err.message}` 
          });
        }
        return res.status(400).json({ 
          error: err.message || 'Solo se permiten archivos Excel (.xlsx, .xls)' 
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No se proporcionó ningún archivo' 
        });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel no contiene hojas de cálculo'
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      if (!worksheet) {
        return res.status(400).json({
          error: 'No se pudo leer la hoja de cálculo'
        });
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as any[][];

      if (jsonData.length === 0) {
        return res.status(400).json({
          error: 'El archivo Excel está vacío'
        });
      }

      // Find the header row by looking for bank statement keywords
      const bankKeywords = ['fecha', 'debe', 'haber', 'saldo', 'transacción', 'transaccion', 'referencia', 'descripción', 'descripcion'];
      let headerRowIndex = -1;
      let allHeaders: string[] = [];

      for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const rowStr = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
        const keywordsFound = bankKeywords.filter(keyword => rowStr.includes(keyword)).length;

        // If we find at least 3 bank keywords in this row, it's likely the header
        if (keywordsFound >= 3) {
          headerRowIndex = i;
          allHeaders = row.map(cell => String(cell || '').trim());
          console.log(`Found header row at index ${i} with keywords:`, allHeaders);
          break;
        }
      }

      // If no header row found with keywords, fall back to first non-empty row
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          if (row && row.length > 0 && row.some(cell => String(cell || '').trim() !== '')) {
            headerRowIndex = i;
            allHeaders = row.map(cell => String(cell || '').trim());
            console.log(`Using first non-empty row at index ${i} as header:`, allHeaders);
            break;
          }
        }
      }
      
      if (headerRowIndex === -1 || !allHeaders || allHeaders.length === 0) {
        return res.status(400).json({
          error: 'El archivo no contiene encabezados válidos. Verifique que el archivo contenga columnas como Fecha, Debe, Haber, Saldo.'
        });
      }

      // Process rows after the header row
      const rows = jsonData.slice(headerRowIndex + 1).map(row => {
        const rowObj: any = {};
        allHeaders.forEach((header, idx) => {
          rowObj[header] = (row[idx] !== undefined) ? row[idx] : "";
        });
        return rowObj;
      }).filter(row => {
        // Filter out empty rows
        return Object.values(row).some(value => value != null && String(value).trim() !== '');
      });

      console.log(`Filtered ${jsonData.length - headerRowIndex - 1 - rows.length} empty rows from bank statement`);
      console.log('Bank statement processed:', {
        fileName: req.file.originalname,
        headers: allHeaders,
        totalRows: jsonData.length - 1,
        rowCount: rows.length,
        firstRow: rows[0]
      });

      await storage.createBankStatement({
        fileName: req.file.originalname,
        headers: allHeaders,
        rows,
        rowCount: String(rows.length),
      });

      console.log('\n=== RESUMEN DE CARGA DE ESTADO DE CUENTA ===');
      console.log(`Archivo: ${req.file.originalname}`);
      console.log(`Registros cargados: ${rows.length}`);
      console.log('=============================================\n');

      res.json({
        success: true,
        data: {
          headers: allHeaders,
          rows,
          fileName: req.file.originalname,
          rowCount: rows.length,
        },
        message: `Se cargaron ${rows.length} registros del estado de cuenta bancario`
      });
    } catch (error) {
      console.error('Error processing bank statement file:', error);
      res.status(500).json({
        error: 'Error al procesar el archivo de estado de cuenta',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // GET endpoint to retrieve latest bank statement
  app.get('/api/bank-statements', async (req, res) => {
    try {
      const latestBankStatement = await storage.getLatestBankStatement();
      
      if (!latestBankStatement) {
        return res.json({
          success: true,
          data: null
        });
      }

      res.json({
        success: true,
        data: {
          headers: latestBankStatement.headers,
          rows: latestBankStatement.rows,
          fileName: latestBankStatement.fileName,
          rowCount: parseInt(latestBankStatement.rowCount, 10),
        }
      });
    } catch (error) {
      console.error('Error fetching bank statements:', error);
      res.status(500).json({
        error: 'Error al obtener el estado de cuenta',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
