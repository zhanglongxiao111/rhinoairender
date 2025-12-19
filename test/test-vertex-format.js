// 测试 Vertex AI Express API 请求格式
// 使用 PowerShell 调用 API 验证是否正常工作

const https = require('https');

// 从环境变量获取 API Key（可以用 Gemini Key 或 Vertex AI Key）
const API_KEY = process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ 错误: 未找到环境变量 VERTEX_API_KEY 或 GEMINI_API_KEY');
    process.exit(1);
}

// 测试两种端点
const ENDPOINTS = [
    {
        name: 'Gemini Developer API',
        base: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.0-flash:generateContent'
    },
    {
        name: 'Vertex AI Express',
        base: 'aiplatform.googleapis.com',
        path: '/v1/publishers/google/models/gemini-2.0-flash:generateContent'
    }
];

// Gemini API 格式（无 role）
const geminiRequestBody = {
    contents: [
        {
            parts: [
                { text: '你好，请生成一个简单的问候语' }
            ]
        }
    ],
    generationConfig: {
        temperature: 1.0
    }
};

// Vertex AI 格式（有 role）
const vertexRequestBody = {
    contents: [
        {
            role: 'user',
            parts: [
                { text: '你好，请生成一个简单的问候语' }
            ]
        }
    ],
    generationConfig: {
        temperature: 1.0
    }
};

async function testEndpoint(endpoint, requestBody, format) {
    return new Promise((resolve) => {
        const url = `https://${endpoint.base}${endpoint.path}?key=${API_KEY}`;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📡 测试: ${endpoint.name} (${format}格式)`);
        console.log(`🌐 端点: ${endpoint.base}${endpoint.path}`);
        console.log(`📤 请求体: ${JSON.stringify(requestBody, null, 2).substring(0, 200)}...`);

        const postData = JSON.stringify(requestBody);

        const options = {
            hostname: endpoint.base,
            port: 443,
            path: `${endpoint.path}?key=${API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📥 响应状态: ${res.statusCode}`);

                if (res.statusCode === 200) {
                    console.log('✅ 成功!');
                    try {
                        const json = JSON.parse(data);
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        console.log(`📝 响应内容: ${text?.substring(0, 100)}...`);
                    } catch (e) {
                        console.log('响应:', data.substring(0, 200));
                    }
                    resolve({ success: true, endpoint: endpoint.name, format });
                } else {
                    console.log('❌ 失败!');
                    try {
                        const errorJson = JSON.parse(data);
                        console.log(`错误信息: ${errorJson.error?.message || data.substring(0, 200)}`);
                    } catch {
                        console.log('原始响应:', data.substring(0, 300));
                    }
                    resolve({ success: false, endpoint: endpoint.name, format, error: data });
                }
            });
        });

        req.on('error', (e) => {
            console.log(`❌ 请求错误: ${e.message}`);
            resolve({ success: false, endpoint: endpoint.name, format, error: e.message });
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('🔑 API Key:', API_KEY.substring(0, 10) + '...');

    const results = [];

    // 测试 Gemini API + 无 role 格式
    results.push(await testEndpoint(ENDPOINTS[0], geminiRequestBody, '无role'));

    // 测试 Gemini API + 有 role 格式
    results.push(await testEndpoint(ENDPOINTS[0], vertexRequestBody, '有role'));

    // 测试 Vertex AI + 无 role 格式
    results.push(await testEndpoint(ENDPOINTS[1], geminiRequestBody, '无role'));

    // 测试 Vertex AI + 有 role 格式
    results.push(await testEndpoint(ENDPOINTS[1], vertexRequestBody, '有role'));

    console.log('\n');
    console.log('='.repeat(60));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(60));

    for (const r of results) {
        const status = r.success ? '✅' : '❌';
        console.log(`${status} ${r.endpoint} + ${r.format}格式`);
    }

    console.log('\n📝 结论:');
    const geminiNoRole = results.find(r => r.endpoint.includes('Gemini') && r.format === '无role');
    const geminiWithRole = results.find(r => r.endpoint.includes('Gemini') && r.format === '有role');
    const vertexNoRole = results.find(r => r.endpoint.includes('Vertex') && r.format === '无role');
    const vertexWithRole = results.find(r => r.endpoint.includes('Vertex') && r.format === '有role');

    if (geminiNoRole?.success && !vertexNoRole?.success && vertexWithRole?.success) {
        console.log('  → Gemini API 不需要 role 字段');
        console.log('  → Vertex AI 需要 role 字段');
        console.log('  → 需要根据端点类型调整请求格式!');
    }
}

runTests();
