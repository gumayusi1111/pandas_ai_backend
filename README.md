# PandasAI 后端服务

这是PandasAI到Pandas代码转换器的后端服务，提供以下功能：

- 接收自然语言查询并生成标准Pandas代码
- 处理数据文件上传（CSV, Excel, JSON等）
- 保存和管理查询历史记录
- 提供RESTful API供前端调用

## 依赖项

- Node.js (v14+)
- Python 3.8+
- PandasAI库及其依赖
- DeepSeek API密钥

## 环境配置

1. 安装Node.js依赖：

```bash
npm install
```

2. 安装Python依赖：

```bash
pip install python-dotenv pandas pandasai matplotlib numpy
```

3. 创建`.env`文件，参考`.env.example`：

```
# DeepSeek AI API配置
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_BASE=https://api.deepseek.com/v1

# 服务器配置
PORT=3001
```

## 运行服务

```bash
npm start
```

服务将在`http://localhost:3001`上运行。

## API端点

### 1. 生成代码

```
POST /api/generate
```

参数：
- `model`: 模型名称 (deepseek-chat 或 deepseek-r1)
- `query`: 自然语言查询
- `csv_file`: (可选) 数据文件

### 2. 获取历史记录

```
GET /api/history
```

### 3. 清除历史记录

```
POST /api/clear_history
```

### 4. 获取支持的文件格式

```
GET /api/supported_formats
```

## 文件结构

- `index.js`: Express服务器主文件
- `pandasai_runner.py`: Python脚本，处理PandasAI代码生成
- `data/`: 存储历史记录
- `uploads/`: 临时存储上传文件（自动清理）

## 部署

该服务已配置为可在Render.com上部署，详情参见`render.yaml`。 