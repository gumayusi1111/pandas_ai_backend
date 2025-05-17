#!/usr/bin/env python
"""
简化版PandasAI测试脚本
"""

import os
import pandas as pd
from pandasai import Agent
from pandasai.llm.local_llm import LocalLLM
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
API_KEY = os.getenv("DEEPSEEK_API_KEY")
API_BASE = os.getenv("DEEPSEEK_API_BASE")

def test_pandasai_simple():
    """使用更简单的方法测试PandasAI"""
    
    print("开始简化版PandasAI测试")
    
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
        
        # 初始化LLM - 与原始项目保持一致
        llm = LocalLLM(
            api_key=API_KEY,
            api_base=API_BASE,
            model="deepseek-chat",
            temperature=0.1,
            max_tokens=2000
        )
        
        # 创建Agent
        agent = Agent(
            df,
            config={
                "llm": llm,
                "verbose": True,
                "enforce_privacy": True,
                "save_charts": True
            },
            memory_size=10
        )
        
        # 使用非常简单的查询来测试基本功能
        print("\n执行简单查询: '计算每种产品类别的销售总额'")
        response = agent.chat("计算每种产品类别的销售总额")
        print("\n回应:")
        print(response)
        
        # 测试完成
        print("\n测试完成!")
        
    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    test_pandasai_simple() 