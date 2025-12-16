// 测试 Gemini 2.5 Flash Image API
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

if (!API_KEY) {
    console.error('❌ 错误: 未找到环境变量 GEMINI_API_KEY');
    process.exit(1);
}

console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
console.log(`🤖 模型: ${MODEL} (快速模式)`);
console.log('');

const requestBody = {
    contents: [
        {
            parts: [
                { text: '请生成一个简单的建筑效果图草图' }
            ]
        }
    ],
    generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.8
    }
};

console.log('📤 发送测试请求...');

const postData = JSON.stringify(requestBody);
const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = https.request(API_URL, options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log(`📥 响应状态: ${res.statusCode}`);
        console.log('');

        if (res.statusCode === 200) {
            try {
                const json = JSON.parse(data);
                const candidates = json.candidates;
                if (candidates && candidates.length > 0) {
                    const parts = candidates[0]?.content?.parts || [];
                    for (const part of parts) {
                        if (part.inlineData || part.inline_data) {
                            const imageData = part.inlineData || part.inline_data;
                            console.log(`✅ 找到图像数据!`);
                            console.log(`   类型: ${imageData.mimeType || imageData.mime_type}`);
                            const imageBuffer = Buffer.from(imageData.data, 'base64');
                            const outputPath = path.join(__dirname, 'test_flash_output.png');
                            fs.writeFileSync(outputPath, imageBuffer);
                            console.log(`   已保存到: ${outputPath}`);
                            console.log('');
                            console.log('🎉 测试成功! Gemini 2.5 Flash Image API 可用。');
                        }
                        if (part.text) {
                            console.log(`📝 文本: ${part.text.substring(0, 100)}...`);
                        }
                    }
                }
            } catch (e) {
                console.error('解析失败:', e.message);
            }
        } else {
            console.error('❌ API 请求失败');
            try {
                const errorJson = JSON.parse(data);
                console.error(JSON.stringify(errorJson.error, null, 2));
            } catch {
                console.error(data.substring(0, 500));
            }
        }
    });
});

req.on('error', (e) => console.error('请求错误:', e.message));
req.write(postData);
req.end();
