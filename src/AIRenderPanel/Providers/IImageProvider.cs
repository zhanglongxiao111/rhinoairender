namespace AIRenderPanel.Providers
{
    /// <summary>
    /// 图像生成 Provider 抽象接口
    /// </summary>
    public interface IImageProvider
    {
        /// <summary>
        /// Provider 名称
        /// </summary>
        string Name { get; }

        /// <summary>
        /// 是否需要 API Key
        /// </summary>
        bool RequiresApiKey { get; }

        /// <summary>
        /// 生成图像
        /// </summary>
        /// <param name="prompt">提示词</param>
        /// <param name="referenceImage">参考图片（截图）</param>
        /// <param name="count">生成数量</param>
        /// <param name="width">宽度</param>
        /// <param name="height">高度</param>
        /// <param name="cancellationToken">取消令牌</param>
        /// <returns>生成结果</returns>
        Task<GenerateResult> GenerateAsync(
            string prompt,
            byte[] referenceImage,
            int count,
            int width,
            int height,
            CancellationToken cancellationToken
        );
    }

    /// <summary>
    /// 生成结果
    /// </summary>
    public class GenerateResult
    {
        /// <summary>
        /// 生成的图片列表（PNG 字节数组）
        /// </summary>
        public List<byte[]> Images { get; set; } = new();

        /// <summary>
        /// 使用的模型名称
        /// </summary>
        public string? Model { get; set; }

        /// <summary>
        /// 请求 ID
        /// </summary>
        public string? RequestId { get; set; }
    }
}
