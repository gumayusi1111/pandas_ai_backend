#!/usr/bin/env python
"""
PandasAI 数据处理助手
=====================
用于处理CSV数据并使用自然语言生成分析结果

使用方法:
python pandasai_helper.py -f 数据文件.csv -q "你的自然语言查询"
"""

import os
import sys
import argparse
import pandas as pd
import matplotlib.pyplot as plt
from pandasai import Agent
from pandasai.llm.local_llm import LocalLLM
from dotenv import load_dotenv
import matplotlib

# 设置中文字体支持
matplotlib.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'Microsoft YaHei', 'WenQuanYi Micro Hei']
matplotlib.rcParams['axes.unicode_minus'] = False  # 正确显示负号

# 加载环境变量
load_dotenv()

# 定义颜色配置
COLORS = {
    'primary': '#3498db',
    'secondary': '#2ecc71',
    'accent': '#9b59b6',
    'warning': '#f39c12',
    'error': '#e74c3c',
    'info': '#1abc9c'
}

def setup_directories():
    """创建必要的目录"""
    directories = ["charts", "output", "logs"]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

def print_colored(text, color='primary'):
    """输出带颜色的文字"""
    colors = {
        'primary': '\033[94m',  # 蓝色
        'secondary': '\033[92m',  # 绿色
        'accent': '\033[95m',  # 紫色
        'warning': '\033[93m',  # 黄色
        'error': '\033[91m',  # 红色
        'info': '\033[96m',  # 青色
        'end': '\033[0m'  # 结束颜色
    }
    print(f"{colors.get(color, colors['primary'])}{text}{colors['end']}")

def process_csv(file_path, query, output_dir="output", charts_dir="charts"):
    """处理CSV文件并执行查询"""
    
    if not os.path.exists(file_path):
        print_colored(f"错误: 文件 '{file_path}' 不存在", 'error')
        return False
    
    API_KEY = os.getenv("DEEPSEEK_API_KEY")
    API_BASE = os.getenv("DEEPSEEK_API_BASE")
    
    if not API_KEY or API_KEY == "your-deepseek-api-key":
        print_colored("错误: 请在.env文件中设置DEEPSEEK_API_KEY", 'error')
        return False
        
    if not API_BASE:
        print_colored("错误: 请在.env文件中设置DEEPSEEK_API_BASE", 'error')
        return False

    try:
        # 读取CSV文件
        print_colored(f"正在读取文件: {file_path}", 'info')
        df = pd.read_csv(file_path)
        print_colored(f"成功读取CSV数据: {df.shape[0]}行, {df.shape[1]}列", 'secondary')
        
        # 显示数据概览
        print_colored("\n数据概览:", 'primary')
        print(df.head(5))
        print_colored("\n数据类型:", 'primary')
        print(df.dtypes)
        
        # 初始化LLM
        print_colored("\n初始化PandasAI...", 'info')
        llm = LocalLLM(
            api_key=API_KEY,
            api_base=API_BASE,
            model="deepseek-chat",
            temperature=0.1,
            max_tokens=2000
        )
        
        # 创建Agent，开启保存图表选项
        agent = Agent(
            df,
            config={
                "llm": llm,
                "verbose": True,
                "enforce_privacy": True,
                "save_charts": True,
                "save_charts_path": charts_dir,
                "custom_whitelisted_dependencies": ["matplotlib.pyplot", "matplotlib.rcParams"]
            },
            memory_size=10
        )
        
        # 执行查询
        print_colored(f"\n执行查询: '{query}'", 'accent')
        response = agent.chat(query)
        
        # 显示结果
        print_colored("\n查询结果:", 'secondary')
        print(response)
        
        # 保存结果
        output_path = os.path.join(output_dir, "query_result.txt")
        with open(output_path, "w") as f:
            f.write(f"查询: {query}\n\n")
            f.write(f"结果:\n{response}\n")
        
        print_colored(f"\n结果已保存至: {output_path}", 'secondary')
        return True
        
    except Exception as e:
        print_colored(f"错误: {str(e)}", 'error')
        import traceback
        print(traceback.format_exc())
        return False

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="PandasAI 数据处理助手")
    parser.add_argument("-f", "--file", help="CSV数据文件路径", required=True)
    parser.add_argument("-q", "--query", help="自然语言查询", required=True)
    parser.add_argument("-o", "--output", help="输出目录", default="output")
    parser.add_argument("-c", "--charts", help="图表输出目录", default="charts")
    
    args = parser.parse_args()
    
    setup_directories()
    
    print_colored("=" * 60, 'info')
    print_colored("PandasAI 数据处理助手", 'primary')
    print_colored("=" * 60, 'info')
    
    success = process_csv(args.file, args.query, args.output, args.charts)
    
    if success:
        print_colored("\n处理完成!", 'secondary')
    else:
        print_colored("\n处理失败!", 'error')
    
    print_colored("=" * 60, 'info')

if __name__ == "__main__":
    main() 