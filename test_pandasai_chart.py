#!/usr/bin/env python
"""
支持中文字体的PandasAI图表测试脚本
"""

import os
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
API_KEY = os.getenv("DEEPSEEK_API_KEY")
API_BASE = os.getenv("DEEPSEEK_API_BASE")

def test_pandasai_chart():
    """使用支持中文的图表测试PandasAI"""
    
    print("开始PandasAI中文图表测试")
    
    # 读取CSV文件
    try:
        df = pd.read_csv("sample_data.csv")
        print(f"成功读取CSV文件: {df.shape[0]}行, {df.shape[1]}列")
        
        # 检查API密钥和API基础URL
        if API_KEY is None or API_KEY == "your-deepseek-api-key":
            print("错误: API密钥未设置")
            return
        
        if API_BASE is None:
            print("错误: API基础URL未设置")
            return
        
        print("\n初始化PandasAI Agent...")
        
        # 初始化LLM
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
                "save_charts_path": "./charts",
                # PandasAI 2.4.2版本需要列表格式
                "custom_whitelisted_dependencies": ["matplotlib.pyplot", "matplotlib.rcParams"]
            },
            memory_size=10
        )
        
        # 确保图表保存目录存在
        os.makedirs("./charts", exist_ok=True)
        
        # 使用要求生成图表的查询
        print("\n执行查询: '使用条形图展示各类别产品的销售总额'")
        response = agent.chat("使用条形图展示各类别产品的销售总额")
        print("\n回应:")
        print(response)
        
        # 检查是否生成了图表
        print("\n检查生成的图表文件:")
        os.system("ls -la ./charts")
        
        # 测试完成
        print("\n测试完成!")
        
    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    test_pandasai_chart() 