#!/usr/bin/env python
"""
测试PandasAI处理CSV文件
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

def test_csv_processing():
    """测试CSV文件处理"""
    
    print("开始测试PandasAI CSV文件处理")
    
    # 读取CSV文件
    try:
        df = pd.read_csv("sample_data.csv")
        print(f"成功读取CSV文件: {df.shape[0]}行, {df.shape[1]}列")
        print("\n数据预览:")
        print(df.head(3))
        print("\n数据类型:")
        print(df.dtypes)
        
        # 只有当API密钥有效时才继续
        if API_KEY != "your-deepseek-api-key":
            # 初始化LLM
            llm = LocalLLM(
                api_key=API_KEY,
                api_base=API_BASE,
                model="deepseek-chat"
            )
            
            # 创建PandasAI代理
            agent = Agent([df], config={"llm": llm, "verbose": True})
            
            # 测试查询
            print("\n测试查询: '找出销量最高的产品类别'")
            response = agent.chat("找出销量最高的产品类别")
            print(f"查询结果: {response}")
            
            if hasattr(agent, 'last_code_executed'):
                print("\n生成的代码:")
                print(agent.last_code_executed)
        else:
            print("\n跳过PandasAI测试 - API密钥未设置")
            
    except Exception as e:
        print(f"测试失败: {str(e)}")

if __name__ == "__main__":
    test_csv_processing() 