# PandasAI 中文数据分析工具

## 项目简介

这是一个基于PandasAI的中文数据分析工具，可以使用自然语言查询来分析CSV数据并生成可视化图表。它使用DeepSeek AI作为大型语言模型后端，支持中文查询和中文图表显示。

## 功能特点

- 📊 使用自然语言分析CSV数据
- 📈 自动生成数据可视化图表
- 🈶 完整支持中文查询和显示
- 💾 保存分析结果和图表
- 🎨 美观的命令行界面
- 📂 支持多种CSV数据格式

## 环境要求

- Python 3.9+
- pandas 1.5.3
- pandasai 2.4.2
- numpy 1.23.5
- matplotlib (已在requirements.txt中指定)
- DeepSeek AI API密钥

## 安装说明

1. 克隆项目或下载代码

2. 创建虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

4. 配置环境变量
```bash
# 创建.env文件并设置以下内容
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_BASE=https://dseek.aikeji.vip/v1/
```

## 使用方法

### 基本用法

```bash
python pandasai_helper.py -f 数据文件.csv -q "你的自然语言查询"
```

### 示例

```bash
# 分析销售数据，生成饼图
python pandasai_helper.py -f sample_data.csv -q "分析各地区的销售情况，并用饼图展示不同地区的销售额占比"

# 查找最畅销产品
python pandasai_helper.py -f sample_data.csv -q "找出销量最高的前3个产品，并计算它们的总销售额"

# 按月统计销售额
python pandasai_helper.py -f sample_data.csv -q "按月份统计销售额，并用折线图展示趋势"
```

### 参数说明

- `-f, --file`: CSV数据文件路径（必需）
- `-q, --query`: 自然语言查询（必需）
- `-o, --output`: 输出结果保存目录（默认: output）
- `-c, --charts`: 图表保存目录（默认: charts）

## 示例查询

以下是一些可以使用的示例查询：

- "计算每个类别产品的总销售额，并用条形图展示"
- "分析不同地区的平均单价与销量的关系"
- "找出销售额最高的产品和最低的产品"
- "计算每个产品类别的销售额占总销售额的百分比"
- "分析每月销售额的变化趋势，并预测下个月的可能销售额"
- "找出单价与销量之间是否存在相关性，并进行可视化展示"

## 常见问题

### 图表中文显示乱码
这通常是由于字体问题导致的。脚本已经配置了多种中文字体，如果仍然出现乱码，可能是因为您的系统缺少相应字体。可以尝试安装"SimHei"或"Microsoft YaHei"字体。

### API密钥错误
如果遇到API认证错误，请确保在.env文件中正确设置了DeepSeek API密钥和基础URL。

### 内存错误
处理大型CSV文件时可能会出现内存错误。在这种情况下，可以尝试减小文件大小或增加系统内存。

## 更多资源

- [PandasAI官方文档](https://docs.pandas-ai.com/)
- [DeepSeek AI API文档](https://platform.deepseek.com/api-docs)
- [Pandas官方文档](https://pandas.pydata.org/docs/) 