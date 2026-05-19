import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Supabase - نستخدم دالة مساعدة للتأكد من التحميل
let supabase = null;

async function getSupabase() {
  if (supabase) return supabase;
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
    logger.info('Supabase client initialized');
    return supabase;
  } catch (error) {
    logger.error('Failed to initialize Supabase:', error.message);
    return null;
  }
}

// مسار صحي - بسيط ولا يحتاج لـ await
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: !!supabase
  });
});

// مسار البيانات - نستخدم async بشكل صحيح
app.get('/api/data', async (req, res, next) => {
  try {
    const client = await getSupabase();
    
    if (!client) {
      return res.status(503).json({ error: 'Supabase not configured yet' });
    }
    
    // مثال: جلب بيانات - يمكنك تغيير اسم الجدول
    const { data, error } = await client
      .from('your_table_name')
      .select('*')
      .limit(10);
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// تصدير التطبيق لـ Vercel
export default app;app.get('/api/health', (req, res) => {
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
