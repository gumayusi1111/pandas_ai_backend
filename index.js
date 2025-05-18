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
app.use(cors({
  origin: ['https://pandasai.onrender.com', 'http://localhost:5173', 'https://pandas-ai-frontend.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend build - 只在本地开发环境使用
if (fs.existsSync(path.join(__dirname, '../frontend/dist'))) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// Serve chart images from the charts directory
app.use('/charts', express.static(path.join(__dirname, 'charts')));

// AI Config file path
const aiConfigPath = path.join(__dirname, 'data', 'ai_config.json');

// Helper function to load all AI configs and the active ID
function loadAllAiConfigs() {
  if (fs.existsSync(aiConfigPath)) {
    try {
      const data = fs.readFileSync(aiConfigPath, 'utf8');
      // Ensure that if parsing fails or structure is wrong, we return a default
      const parsedData = JSON.parse(data);
      if (parsedData && Array.isArray(parsedData.configurations) && typeof parsedData.activeConfigId !== 'undefined') {
        return parsedData;
      }
      logToFile('AI config file has incorrect structure, returning default.', 'warn');
      // Fallthrough to default if structure is not as expected
    } catch (error) {
      logToFile(`Error loading AI configs: ${error.message}. Returning default.`, 'error');
      // Fallthrough to default if parsing fails
    }
  }
  // Return default structure if file doesn't exist or on any error during load/parse
  return { configurations: [], activeConfigId: null };
}

// Helper function to save all AI configs and the active ID
function saveAllAiConfigs(configsObject) { // configsObject is { configurations: [], activeConfigId: "..." }
  try {
    fs.writeFileSync(aiConfigPath, JSON.stringify(configsObject, null, 2), 'utf8');
    logToFile('AI configurations saved successfully.');
  } catch (error) {
    logToFile(`Error saving AI configurations: ${error.message}`, 'error');
  }
}

// API endpoint to get current AI config (THIS WILL BE REPLACED/REMOVED SOON)
// For now, let's adapt it to return the active config or the first one if no activeId
app.get('/api/ai-config', (req, res) => {
  const allConfigs = loadAllAiConfigs();
  let activeConfig = allConfigs.configurations.find(c => c.id === allConfigs.activeConfigId);
  if (!activeConfig && allConfigs.configurations.length > 0) {
    // Fallback to the first config if no active one is set (should ideally not happen with proper management)
    activeConfig = allConfigs.configurations[0]; 
  }
  if (activeConfig) {
    res.json(activeConfig);
  } else {
    // If no configs exist at all, return a default-like structure or an error/empty object
    res.status(404).json({ error: 'No AI configurations found or no active configuration set.', apiBaseUrl: '', apiKey: '', modelName: 'deepseek-chat' });
  }
});

// API endpoint to update AI config (THIS WILL BE REPLACED/REMOVED SOON)
// For now, let's make it update the first config, or add if none exist, and set it active.
// This is temporary to keep frontend somewhat functional until new endpoints are ready.
app.put('/api/ai-config', (req, res) => {
  const { apiBaseUrl, apiKey, modelName } = req.body;
  if (typeof apiBaseUrl === 'undefined' || typeof apiKey === 'undefined' || typeof modelName === 'undefined') {
    return res.status(400).json({ error: 'Missing required fields: apiBaseUrl, apiKey, modelName' });
  }

  const allConfigs = loadAllAiConfigs();
  let configToUpdate;
  let newConfigId = `config-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  if (allConfigs.activeConfigId) {
    configToUpdate = allConfigs.configurations.find(c => c.id === allConfigs.activeConfigId);
  }
  
  if (configToUpdate) {
    configToUpdate.apiBaseUrl = apiBaseUrl;
    configToUpdate.apiKey = apiKey;
    configToUpdate.modelName = modelName;
    // Keep its existing name or default if it was somehow missing
    configToUpdate.name = configToUpdate.name || `Config ${allConfigs.configurations.indexOf(configToUpdate) + 1}`;
  } else if (allConfigs.configurations.length > 0 && !allConfigs.activeConfigId) {
    // If there are configs but no active one, update the first one as a fallback
    configToUpdate = allConfigs.configurations[0];
    configToUpdate.apiBaseUrl = apiBaseUrl;
    configToUpdate.apiKey = apiKey;
    configToUpdate.modelName = modelName;
    configToUpdate.name = configToUpdate.name || 'Default Config';
    allConfigs.activeConfigId = configToUpdate.id; // Set it active
  } else {
    // No configs exist, or no active one and no existing ones to update: add a new one
    configToUpdate = {
      id: newConfigId,
      name: 'Default Config', // Give it a default name
      apiBaseUrl,
      apiKey,
      modelName,
      isActive: true // Implicitly, as it will be the only one / made active
    };
    allConfigs.configurations.push(configToUpdate);
    allConfigs.activeConfigId = newConfigId;
  }
  
  // Ensure isActive flag is consistent with activeConfigId
  allConfigs.configurations.forEach(c => {
    c.isActive = (c.id === allConfigs.activeConfigId);
  });

  saveAllAiConfigs(allConfigs);
  // Return the updated/added config that is now active
  const activeSavedConfig = allConfigs.configurations.find(c => c.id === allConfigs.activeConfigId);
  res.json({ message: 'AI configuration updated successfully', config: activeSavedConfig });
});

// --- New CRUD Endpoints for Multiple AI Configurations ---

// GET all AI configurations
app.get('/api/ai-configs', (req, res) => {
  const allConfigs = loadAllAiConfigs();
  res.json(allConfigs); // Returns { configurations: [], activeConfigId: "..." }
});

// POST a new AI configuration
app.post('/api/ai-configs', (req, res) => {
  const { name, apiBaseUrl, apiKey, modelName } = req.body;

  if (!name || typeof apiBaseUrl === 'undefined' || typeof apiKey === 'undefined' || typeof modelName === 'undefined') {
    return res.status(400).json({ error: 'Missing required fields: name, apiBaseUrl, apiKey, modelName' });
  }

  const allConfigs = loadAllAiConfigs();
  const newConfigId = `config-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  const newConfig = {
    id: newConfigId,
    name,
    apiBaseUrl,
    apiKey,
    modelName,
    isActive: false // Will be set to true if it becomes the active one
  };

  allConfigs.configurations.push(newConfig);

  // If no config is currently active, or if it's the first config, make this new one active.
  if (!allConfigs.activeConfigId || allConfigs.configurations.length === 1) {
    allConfigs.activeConfigId = newConfigId;
  }
  
  // Ensure isActive flags are consistent
  allConfigs.configurations.forEach(c => {
    c.isActive = (c.id === allConfigs.activeConfigId);
  });

  saveAllAiConfigs(allConfigs);
  // Return the newly created config (it might not be the active one if one was already active)
  const createdConfig = allConfigs.configurations.find(c => c.id === newConfigId);
  res.status(201).json({ message: 'AI configuration added successfully', config: createdConfig, allConfigs });
});

// PUT to set an AI configuration as active
app.put('/api/ai-configs/:id/set-active', (req, res) => {
  const { id } = req.params;
  const allConfigs = loadAllAiConfigs();

  const configToActivate = allConfigs.configurations.find(c => c.id === id);

  if (!configToActivate) {
    return res.status(404).json({ error: 'Configuration not found' });
  }

  allConfigs.activeConfigId = id;
  allConfigs.configurations.forEach(c => {
    c.isActive = (c.id === id);
  });

  saveAllAiConfigs(allConfigs);
  res.json({ message: `Configuration '${configToActivate.name}' set to active.`, activeConfigId: id, configurations: allConfigs.configurations });
});

// PUT to update an existing AI configuration by ID
app.put('/api/ai-configs/:id', (req, res) => {
  const { id } = req.params;
  const { name, apiBaseUrl, apiKey, modelName } = req.body;

  // Basic validation for incoming data
  if (!name || typeof apiBaseUrl === 'undefined' || typeof apiKey === 'undefined' || typeof modelName === 'undefined') {
    return res.status(400).json({ error: 'Missing required fields: name, apiBaseUrl, apiKey, modelName' });
  }

  const allConfigs = loadAllAiConfigs();
  const configIndex = allConfigs.configurations.findIndex(c => c.id === id);

  if (configIndex === -1) {
    return res.status(404).json({ error: 'Configuration not found' });
  }

  // Update the configuration details
  allConfigs.configurations[configIndex] = {
    ...allConfigs.configurations[configIndex], // Keep existing id and isActive status initially
    name,
    apiBaseUrl,
    apiKey,
    modelName
  };
  // isActive status is managed by activeConfigId and set-active endpoint, 
  // but ensure it's present if we are overwriting the object.
  // The isActive flag on the object itself will be re-synced if set-active is called or a new config is added.

  saveAllAiConfigs(allConfigs);
  res.json({ message: `Configuration '${name}' updated successfully.`, config: allConfigs.configurations[configIndex] });
});

// DELETE an AI configuration by ID
app.delete('/api/ai-configs/:id', (req, res) => {
  const { id } = req.params;
  const allConfigs = loadAllAiConfigs();

  const configIndex = allConfigs.configurations.findIndex(c => c.id === id);

  if (configIndex === -1) {
    return res.status(404).json({ error: 'Configuration not found' });
  }

  const deletedConfig = allConfigs.configurations[configIndex];

  // Prevent deleting the active configuration if it's the only one
  // Or, more robustly, if it is active, require another to be set active first, or clear activeConfigId.
  // For simplicity now, if the deleted one was active, and there are others, make the first one active.
  // If it was active and it's the last one, clear activeConfigId.
  if (allConfigs.activeConfigId === id) {
    allConfigs.configurations.splice(configIndex, 1); // Remove the config
    if (allConfigs.configurations.length > 0) {
      allConfigs.activeConfigId = allConfigs.configurations[0].id; // Make the new first one active
      allConfigs.configurations[0].isActive = true;
    } else {
      allConfigs.activeConfigId = null; // No configs left
    }
  } else {
    allConfigs.configurations.splice(configIndex, 1); // Just remove if not active
  }
  
  // Ensure isActive flags are consistent
  allConfigs.configurations.forEach(c => {
    c.isActive = (c.id === allConfigs.activeConfigId);
  });

  saveAllAiConfigs(allConfigs);
  res.json({ message: `Configuration '${deletedConfig.name}' deleted successfully.`, activeConfigId: allConfigs.activeConfigId });
});

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
  
  logToFile(`Processing request: Query=${query}, File=${filePath || 'None'}, Preference=${preference || 'None'}`);

  const allConfigs = loadAllAiConfigs();
  const activeConfig = allConfigs.configurations.find(c => c.id === allConfigs.activeConfigId);

  if (!activeConfig) {
    logToFile('No active AI provider configuration found.', 'error');
    return res.status(500).json({ error: 'No active AI provider configuration found. Please set one in settings.' });
  }
  
  const modelNameToUse = model || activeConfig.modelName || 'deepseek-chat';
  
  if (!activeConfig.apiKey || !activeConfig.apiBaseUrl) {
      logToFile('Active AI provider API key or Base URL is not configured.', 'error');
      return res.status(500).json({ error: 'Active AI provider not configured. Please set API key and base URL in settings.' });
  }
  
  if (!query) {
    logToFile('Missing required parameter: query', 'error');
    return res.status(400).json({ error: 'Missing required parameter: query' });
  }
  
  // Prepare arguments for Python script
  const pythonArgs = [
    path.join(__dirname, 'pandasai_runner.py'),
    query,
    filePath || 'none',
    '--model-name', modelNameToUse,
    '--preference', preference || 'default',
    '--api-key', activeConfig.apiKey,
    '--api-base-url', activeConfig.apiBaseUrl
  ];
  
  // Mask API key for logging
  const loggedPythonArgs = pythonArgs.map((arg, index, arr) => {
    if (index > 0 && arr[index - 1] === '--api-key' && typeof arg === 'string' && arg.startsWith('sk-')) {
      return `sk-xxxx...${arg.substring(arg.length - 4)}`;
    }
    return arg;
  });
  logToFile(`Spawning Python script with args: ${loggedPythonArgs.map(arg => typeof arg === 'string' && arg.includes(' ') ? `\"${arg}\"` : arg).join(' ')}`);

  const pythonProcess = spawn('python', pythonArgs);

  let scriptOutput = '';
  let errorLogs = '';
  
  pythonProcess.stdout.on('data', (data) => {
    scriptOutput += data.toString();
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
      const resultObj = JSON.parse(scriptOutput);
      
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
      logToFile(`Raw result was: ${scriptOutput.substring(0, 200)}...`, 'error');
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
      // 使用绝对URL路径，确保前端可以正确访问
      const chartUrl = `${req.protocol}://${req.get('host')}/charts/${chartFile}`;
      
      // 记录图表URL以便调试
      logToFile(`Serving chart at URL: ${chartUrl}`);
      
      res.json({ 
        chartUrl,
        fileName: chartFile,
        timestamp: new Date().toISOString()
      });
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
    res.json(history || []);
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

// SPA fallback - 只在本地开发环境使用
app.get('*', (req, res) => {
  const frontendPath = path.join(__dirname, '../frontend/dist/index.html');
  if (fs.existsSync(frontendPath)) {
    res.sendFile(frontendPath);
  } else {
    // 在Render部署中，前端在Vercel上，所以不需要提供前端文件
    res.status(404).json({ message: 'API endpoint not found. Frontend is served from a different origin.' });
  }
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