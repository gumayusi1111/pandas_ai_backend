const axios = require('axios');

// 配置信息
const baseUrl = process.env.API_URL || 'http://localhost:3001';
const proxyPath = '/proxy/aitopia/ai/prompts';
const fullUrl = `${baseUrl}${proxyPath}`;

console.log(`测试代理API: ${fullUrl}`);

// 测试参数
const testPayload = {
  lang: 'en',
  v: '5.8.0',
  ri: 'becfinhbfclcgokjlobojlnldbfillpf',
  bt: 'self'
};

// 执行测试请求
async function testProxyAPI() {
  try {
    console.log('发送请求...');
    const response = await axios.post(fullUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('代理请求成功!');
    console.log('状态码:', response.status);
    console.log('响应头:', JSON.stringify(response.headers, null, 2));
    console.log('响应体 (前200个字符):', JSON.stringify(response.data).substring(0, 200));
    
    return true;
  } catch (error) {
    console.error('代理请求失败:');
    
    if (error.response) {
      // 服务器返回了响应，但状态码不在2xx范围
      console.error('状态码:', error.response.status);
      console.error('响应头:', JSON.stringify(error.response.headers, null, 2));
      if (error.response.data) {
        console.error('响应体:', typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) 
          : JSON.stringify(error.response.data).substring(0, 200));
      }
    } else if (error.request) {
      // 请求已发出但未收到响应
      console.error('未收到响应:', error.message);
    } else {
      // 在设置请求时发生错误
      console.error('请求错误:', error.message);
    }
    
    return false;
  }
}

// 运行测试
testProxyAPI()
  .then(success => {
    console.log('测试完成', success ? '成功' : '失败');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('测试过程出错:', err);
    process.exit(1);
  }); 