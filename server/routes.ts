import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
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

      const headers = jsonData[0] as string[];
      
      if (!headers || headers.length === 0) {
        return res.status(400).json({
          error: 'El archivo no contiene encabezados válidos'
        });
      }

      const rows = jsonData.slice(1).map(row => {
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] !== undefined ? row[idx] : "";
        });
        return rowObj;
      });

      res.json({
        success: true,
        data: {
          headers,
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

  const httpServer = createServer(app);
  return httpServer;
}
