#!/usr/bin/env python
"""
测试DeepSeek API连接
"""

import os
from dotenv import load_dotenv
from openai import OpenAI

# 加载环境变量
load_dotenv()
API_KEY = os.getenv("DEEPSEEK_API_KEY")
API_BASE = os.getenv("DEEPSEEK_API_BASE")

def test_api_connection():
    """测试API连接"""
    
    print("DeepSeek API连接测试")
    print(f"API基础URL: {API_BASE}")
    print(f"API密钥: {'已设置' if API_KEY else '未设置'}")
    
    if not API_KEY or API_KEY == "your-deepseek-api-key":
        print("错误: API密钥未设置或使用了默认值")
        print("请在.env文件中设置有效的API密钥")
        return
        
    if not API_BASE:
        print("错误: API基础URL未设置")
        return
    
    try:
        # 初始化客户端
        client = OpenAI(
            api_key=API_KEY,
            base_url=API_BASE
        )
        
        # 发送简单请求
        print("\n发送测试请求...")
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "user", "content": "你好，这是一个测试消息"}
            ],
            max_tokens=50
        )
        
        # 输出结果
        print("\n请求成功! 响应内容:")
        print(response.choices[0].message.content)
        print("\nAPI连接测试成功!")
        
    except Exception as e:
        print(f"\n错误: API连接失败: {str(e)}")
        print("\n可能的问题及解决方案:")
        print("1. API密钥格式不正确 - DeepSeek API密钥通常以'sk-'开头")
        print("2. API密钥已过期或无效")
        print("3. API基础URL不正确 - 请检查URL格式，确保以'/'结尾")
        print("4. 网络连接问题")
        print("5. 账户额度已用尽")

if __name__ == "__main__":
    test_api_connection() 