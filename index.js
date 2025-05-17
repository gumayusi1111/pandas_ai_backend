const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// 创建日志目录
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)){
  fs.mkdirSync(logsDir, { recursive: true });
}

// 创建charts目录
const chartsDir = path.join(__dirname, 'charts');
if (!fs.existsSync(chartsDir)){
  fs.mkdirSync(chartsDir, { recursive: true });
}

// 日志记录函数
function logToFile(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
  const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Error writing to log file:', err);
  });
  
  // 同时输出到控制台
  console[type === 'error' ? 'error' : 'log'](logEntry.trim());
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)){
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // 记录请求
  logToFile(`${clientIP} ${req.method} ${req.url}`);
  
  // 完成时记录响应状态和时间
  res.on('finish', () => {
    const duration = Date.now() - start;
    logToFile(`${clientIP} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logToFile(`Error processing ${req.method} ${req.url}: ${err.message}`, 'error');
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Serve chart images from the charts directory
app.use('/charts', express.static(path.join(__dirname, 'charts')));

// History file path
const historyFilePath = path.join(__dirname, 'data', 'history.json');
// Track the latest chart file
let latestChartFile = null;

// Ensure data directory exists
if (!fs.existsSync(path.dirname(historyFilePath))){
  fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
}

// Helper function to load history
function loadHistory() {
  if (fs.existsSync(historyFilePath)) {
    try {
      const data = fs.readFileSync(historyFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logToFile(`Error loading history: ${error.message}`, 'error');
    }
  }
  return [];
}

// Helper function to save history
function saveHistory(history) {
  try {
    // Ensure history is limited to 15 items
    const limitedHistory = history.slice(0, 15);
    fs.writeFileSync(historyFilePath, JSON.stringify(limitedHistory, null, 2), 'utf8');
  } catch (error) {
    logToFile(`Error saving history: ${error.message}`, 'error');
  }
}

// Helper function to find the most recent chart file
function findLatestChartFile() {
  try {
    const chartFiles = fs.readdirSync(chartsDir).filter(file => 
      file.endsWith('.png') || file.endsWith('.jpg')
    );
    
    if (chartFiles.length === 0) return null;
    
    // Sort files by creation time (most recent first)
    const sortedFiles = chartFiles.map(file => {
      const filePath = path.join(chartsDir, file);
      return { 
        file, 
        ctime: fs.statSync(filePath).ctime 
      };
    }).sort((a, b) => b.ctime - a.ctime);
    
    return sortedFiles[0].file;
  } catch (error) {
    logToFile(`Error finding latest chart: ${error.message}`, 'error');
    return null;
  }
}

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/generate', upload.single('csv_file'), (req, res) => {
  const { model, query, preference } = req.body;
  const filePath = req.file ? req.file.path : null;
  
  logToFile(`Processing request: Model=${model}, Query=${query}, File=${filePath || 'None'}, Preference=${preference || 'None'}`);
  
  // 验证请求参数
  if (!model || !query) {
    logToFile('Missing required parameters', 'error');
    return res.status(400).json({ error: '缺少必要的参数：model和query' });
  }
  
  // Run Python script to generate code
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'pandasai_runner.py'),
    model,
    query,
    filePath || 'none',
    preference || 'default'
  ]);
  
  let result = '';
  let errorLogs = '';
  
  pythonProcess.stdout.on('data', (data) => {
    result += data.toString();
  });
  
  pythonProcess.stderr.on('data', (data) => {
    // 收集stderr输出但作为日志记录，而不是错误
    const logMsg = data.toString();
    errorLogs += logMsg;
    logToFile(`Python debug: ${logMsg.trim()}`, 'info');
  });
  
  // 设置超时，防止进程卡住
  const timeout = setTimeout(() => {
    pythonProcess.kill();
    logToFile('Python process timed out after 60 seconds', 'error');
    return res.status(500).json({ error: '代码生成超时，请稍后重试' });
  }, 60000); // 60秒超时
  
  pythonProcess.on('close', (code) => {
    clearTimeout(timeout);
    logToFile(`Python process exited with code ${code}`);
    
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    if (code !== 0) {
      return res.status(500).json({ 
        error: `代码生成错误: 进程退出码 ${code}` 
      });
    }
    
    try {
      // Attempt to parse the JSON result
      const resultObj = JSON.parse(result);
      
      // If the parsed object contains an error from Python, return it
      if (resultObj.error) {
        logToFile(`Error from Python: ${resultObj.error}`, 'error');
        return res.status(500).json({ 
          error: resultObj.error
        });
      }
      
      // Add to history
      const history = loadHistory();
      history.unshift(resultObj);
      saveHistory(history);
        
      // Check for new chart file
      latestChartFile = findLatestChartFile();
      if (latestChartFile) {
        logToFile(`New chart file detected: ${latestChartFile}`);
      }
      
      res.json(resultObj);
    } catch (e) {
      logToFile(`Error parsing result: ${e.message}`, 'error');
      logToFile(`Raw result was: ${result.substring(0, 200)}...`, 'error');
      res.status(500).json({ 
        error: `解析结果错误: ${e.message}`
      });
    }
  });
});

app.get('/api/latest_chart', (req, res) => {
  try {
    // Update the latest chart file
    const chartFile = findLatestChartFile();
    
    if (chartFile) {
      latestChartFile = chartFile;
      const chartUrl = `/charts/${chartFile}`;
      res.json({ chartUrl });
    } else {
      res.status(404).json({ error: 'No chart available' });
    }
  } catch (error) {
    logToFile(`Error serving chart: ${error.message}`, 'error');
    res.status(500).json({ error: 'Error retrieving chart' });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const history = loadHistory();
    res.json(history);
  } catch (error) {
    logToFile(`Error loading history: ${error.message}`, 'error');
    // 不返回错误，而是返回空数组
    res.json([]);
  }
});

app.post('/api/clear_history', (req, res) => {
  try {
    saveHistory([]);
    res.json({ status: 'success' });
  } catch (error) {
    logToFile(`Error clearing history: ${error.message}`, 'error');
    res.status(500).json({ error: '清除历史记录失败' });
  }
});

app.get('/api/supported_formats', (req, res) => {
  // List of supported file formats
  const formats = ['csv', 'xlsx', 'xls', 'json', 'parquet', 'feather', 'pickle', 'pkl'];
  res.json(formats);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 优雅地处理未捕获的异常
process.on('uncaughtException', (error) => {
  logToFile(`Uncaught Exception: ${error.message}`, 'error');
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
});

app.listen(port, () => {
  logToFile(`PandasAI backend running on port ${port}`);
}); 