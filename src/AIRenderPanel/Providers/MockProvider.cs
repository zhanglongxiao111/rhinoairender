using System.Drawing;
using System.Drawing.Imaging;

namespace AIRenderPanel.Providers
{
    /// <summary>
    /// 模拟 Provider，用于开发调试
    /// </summary>
    public class MockProvider : IImageProvider
    {
        public string Name => "Mock";
        public bool RequiresApiKey => false;

        public async Task<GenerateResult> GenerateAsync(
            string prompt,
            byte[] referenceImage,
            int count,
            int width,
            int height,
            CancellationToken cancellationToken)
        {
            // 模拟网络延迟
            await Task.Delay(1500, cancellationToken);

            var images = new List<byte[]>();

            for (int i = 0; i < count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // 创建一个简单的处理效果：添加滤镜和水印
                var processedImage = ProcessImage(referenceImage, prompt, i + 1, count);
                images.Add(processedImage);

                // 每张图片之间稍微延迟
                if (i < count - 1)
                {
                    await Task.Delay(500, cancellationToken);
                }
            }

            return new GenerateResult
            {
                Images = images,
                Model = "mock-v1",
                RequestId = Guid.NewGuid().ToString("N")[..8]
            };
        }

        /// <summary>
        /// 处理图片：添加颜色滤镜和水印
        /// </summary>
        private byte[] ProcessImage(byte[] sourceImage, string prompt, int index, int total)
        {
            using var ms = new MemoryStream(sourceImage);
            using var original = Image.FromStream(ms);
            using var bitmap = new Bitmap(original.Width, original.Height);
            using var g = Graphics.FromImage(bitmap);

            // 绘制原图
            g.DrawImage(original, 0, 0, original.Width, original.Height);

            // 添加半透明颜色叠加（模拟滤镜效果）
            var overlayColors = new[]
            {
                Color.FromArgb(30, 255, 200, 100),  // 暖色调
                Color.FromArgb(30, 100, 200, 255),  // 冷色调
                Color.FromArgb(30, 200, 100, 255),  // 紫色调
                Color.FromArgb(30, 100, 255, 150),  // 绿色调
            };
            var overlayColor = overlayColors[(index - 1) % overlayColors.Length];
            using var overlayBrush = new SolidBrush(overlayColor);
            g.FillRectangle(overlayBrush, 0, 0, bitmap.Width, bitmap.Height);

            // 添加水印
            var watermark = $"[Mock] AI 渲染 - {index}/{total}";
            using var font = new Font("Microsoft YaHei", 14, FontStyle.Bold);
            using var shadowBrush = new SolidBrush(Color.FromArgb(150, 0, 0, 0));
            using var textBrush = new SolidBrush(Color.White);

            var textSize = g.MeasureString(watermark, font);
            var x = bitmap.Width - textSize.Width - 20;
            var y = bitmap.Height - textSize.Height - 20;

            // 阴影
            g.DrawString(watermark, font, shadowBrush, x + 2, y + 2);
            // 文字
            g.DrawString(watermark, font, textBrush, x, y);

            // 添加提示词显示（左上角）
            var promptDisplay = prompt.Length > 30 ? prompt[..30] + "..." : prompt;
            g.DrawString(promptDisplay, font, shadowBrush, 22, 22);
            g.DrawString(promptDisplay, font, textBrush, 20, 20);

            // 转换为 PNG
            using var outputMs = new MemoryStream();
            bitmap.Save(outputMs, ImageFormat.Png);
            return outputMs.ToArray();
        }
    }
}
