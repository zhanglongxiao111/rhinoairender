// 测试 Gemini 3 Pro Image Preview API
// 使用 PowerShell 调用 API 验证是否正常工作

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

if (!API_KEY) {
    console.error('❌ 错误: 未找到环境变量 GEMINI_API_KEY');
    process.exit(1);
}

console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
console.log(`🤖 模型: ${MODEL}`);
console.log(`🌐 端点: ${API_URL.replace(API_KEY, '***')}`);
console.log('');

// 创建一个简单的测试图片（1x1 红色像素的 PNG）
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

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
        temperature: 1.0
    }
};

console.log('📤 发送测试请求...');
console.log('');

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

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`📥 响应状态: ${res.statusCode}`);
        console.log('');

        if (res.statusCode === 200) {
            try {
                const json = JSON.parse(data);

                // 检查是否有图像数据
                const candidates = json.candidates;
                if (candidates && candidates.length > 0) {
                    const parts = candidates[0]?.content?.parts || [];

                    let hasImage = false;
                    let hasText = false;

                    for (const part of parts) {
                        if (part.inlineData || part.inline_data) {
                            hasImage = true;
                            const imageData = part.inlineData || part.inline_data;
                            console.log(`✅ 找到图像数据!`);
                            console.log(`   类型: ${imageData.mimeType || imageData.mime_type}`);
                            console.log(`   大小: ${(imageData.data || '').length} 字符 (base64)`);

                            // 保存图片
                            const imageBuffer = Buffer.from(imageData.data, 'base64');
                            const outputPath = path.join(__dirname, 'test_output.png');
                            fs.writeFileSync(outputPath, imageBuffer);
                            console.log(`   已保存到: ${outputPath}`);
                        }
                        if (part.text) {
                            hasText = true;
                            console.log(`📝 文本响应: ${part.text.substring(0, 100)}...`);
                        }
                    }

                    if (hasImage) {
                        console.log('');
                        console.log('🎉 测试成功! Gemini 3 Pro Image API 可以正常生成图像。');
                    } else if (hasText) {
                        console.log('');
                        console.log('⚠️  API 只返回了文本，没有图像。可能需要调整提示词或检查模型权限。');
                    } else {
                        console.log('');
                        console.log('⚠️  响应中没有找到图像或文本数据。');
                    }
                } else {
                    console.log('⚠️  响应中没有 candidates');
                    console.log(JSON.stringify(json, null, 2));
                }
            } catch (e) {
                console.error('❌ 解析响应失败:', e.message);
                console.log('原始响应:', data.substring(0, 500));
            }
        } else {
            console.error('❌ API 请求失败');
            try {
                const errorJson = JSON.parse(data);
                console.error('错误信息:', JSON.stringify(errorJson.error, null, 2));
            } catch {
                console.error('原始响应:', data.substring(0, 500));
            }
        }
    });
});

req.on('error', (e) => {
    console.error('❌ 请求错误:', e.message);
});

req.write(postData);
req.end();
