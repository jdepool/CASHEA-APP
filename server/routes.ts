import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";

// Normalize header for flexible matching
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[#\s]+/g, '') // Remove # and spaces
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, ''); // Remove accent marks
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
        raw: false,
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

      // Use all headers from the file as-is
      const rows = jsonData.slice(1).map(row => {
        const rowObj: any = {};
        allHeaders.forEach((header, idx) => {
          rowObj[header] = (row[idx] !== undefined) ? row[idx] : "";
        });
        return rowObj;
      });

      console.log('Payment records processed:', {
        fileName: req.file.originalname,
        headers: allHeaders,
        totalRows: jsonData.length - 1,
        rowCount: rows.length,
        firstRow: rows[0]
      });

      // Save to database
      await storage.createPaymentRecord({
        fileName: req.file.originalname,
        headers: allHeaders,
        rows,
        rowCount: String(rows.length),
      });

      res.json({
        success: true,
        data: {
          headers: allHeaders,
          rows,
          fileName: req.file.originalname,
          rowCount: rows.length,
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
        raw: false,
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

      const requiredHeaders = [
        "Orden",
        "Nombre del comprador",
        "Venta total",
        "Fecha de compra",
        "Tipo orden",
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

      const headerIndexMap = new Map<string, number>();
      allHeaders.forEach((header, idx) => {
        headerIndexMap.set(header, idx);
      });

      const rows = jsonData.slice(1).map(row => {
        const rowObj: any = {};
        requiredHeaders.forEach(header => {
          const idx = headerIndexMap.get(header);
          rowObj[header] = (idx !== undefined && row[idx] !== undefined) ? row[idx] : "";
        });
        return rowObj;
      });

      // Save to database
      await storage.createOrder({
        fileName: req.file.originalname,
        headers: requiredHeaders,
        rows,
        rowCount: String(rows.length),
      });

      res.json({
        success: true,
        data: {
          headers: requiredHeaders,
          rows,
          fileName: req.file.originalname,
          rowCount: rows.length,
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

  const httpServer = createServer(app);
  return httpServer;
}
