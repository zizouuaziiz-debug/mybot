import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// تهيئة Supabase (سنضيف المفاتيح لاحقًا)
let supabase = null;
try {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'your-anon-key'
  );
  logger.info('Supabase client initialized');
} catch (error) {
  logger.warn('Supabase not configured yet, skipping initialization');
}

// مسار صحي للتأكد أن الخادم يعمل
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: !!supabase
  });
});

// مسار تجريبي للبيانات
app.get('/api/data', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }
    
    // مثال: جلب بيانات من جدول (عدل اسم الجدول حسب مشروعك)
    const { data, error } = await supabase
      .from('your_table_name')
      .select('*')
      .limit(10);
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: error.message });
  }
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`API server running on port ${PORT}`);
});
