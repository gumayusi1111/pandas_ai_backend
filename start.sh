#!/bin/bash

# 创建必要的目录
mkdir -p data
mkdir -p uploads

# 检查.env文件是否存在
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Please edit .env file with your API credentials!"
    else
        echo "# DeepSeek AI API配置" > .env
        echo "DEEPSEEK_API_KEY=your-deepseek-api-key" >> .env
        echo "DEEPSEEK_API_BASE=https://api.deepseek.com/v1" >> .env
        echo "" >> .env
        echo "# 服务器配置" >> .env
        echo "PORT=3001" >> .env
        echo ".env file created. Please update with your API credentials!"
    fi
    exit 1
fi

# 安装依赖
echo "Installing Node.js dependencies..."
npm install

# 启动服务
echo "Starting PandasAI backend server..."
node index.js 