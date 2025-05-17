# DeepSeek API连接问题修复指南

根据测试脚本的结果，您的DeepSeek API连接出现了401错误（无效的令牌），这意味着API身份验证失败。以下是解决方法：

## 常见原因和解决方案

### 1. API密钥格式不正确

DeepSeek API密钥通常以`sk-`开头，格式为：
```
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

请检查您的密钥是否有正确的格式，尤其注意：
- 密钥是否包含前缀`sk-`
- 是否包含了多余的空格或特殊字符
- 是否在复制时只复制了部分密钥

### 2. 在.env文件中正确设置API密钥

打开`.env`文件并确保正确设置API密钥：
```bash
# 使用文本编辑器打开.env文件
nano .env

# 修改为您的实际API密钥
DEEPSEEK_API_KEY=sk-your-actual-api-key
```

### 3. API基础URL问题

确保API基础URL格式正确：
```
DEEPSEEK_API_BASE=https://dseek.aikeji.vip/v1/
```

注意：
- URL必须以`/`结尾
- 必须使用正确的域名
- 协议必须是`https://`

### 4. 获取新的API密钥

如果您的API密钥已过期或无效，您可能需要：
1. 登录DeepSeek AI账户
2. 访问API密钥管理页面
3. 删除旧密钥并生成新密钥
4. 将新密钥复制到`.env`文件中

### 5. 检查账户状态

您的DeepSeek AI账户可能：
- 额度已用尽
- 账户受限
- 未启用API访问权限

请登录DeepSeek AI控制台检查您的账户状态。

## 测试修复后的连接

修改`.env`文件后，运行测试脚本验证连接：
```bash
python test_api_connection.py
```

如果连接成功，您将看到成功响应。然后可以再次尝试运行原始PandasAI测试：
```bash
python test_pandasai.py
```

## 其他注意事项

- DeepSeek API在中国大陆访问可能需要特殊设置
- 有些API需要特定的用户权限级别
- 如果问题持续存在，请联系DeepSeek AI的技术支持

希望这些指南能帮助您解决API连接问题！ 