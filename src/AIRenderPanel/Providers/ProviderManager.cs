using AIRenderPanel.Services;

namespace AIRenderPanel.Providers
{
    /// <summary>
    /// Provider 管理器
    /// </summary>
    public class ProviderManager
    {
        private readonly SettingsService _settingsService;
        private readonly Dictionary<string, IImageProvider> _providers;

        public ProviderManager(SettingsService settingsService)
        {
            _settingsService = settingsService;
            _providers = new Dictionary<string, IImageProvider>(StringComparer.OrdinalIgnoreCase)
            {
                ["mock"] = new MockProvider(),
                ["gemini"] = new GeminiProvider(() => _settingsService.LoadSettings().ApiKey)
            };
        }

        /// <summary>
        /// 获取当前配置的 Provider
        /// </summary>
        public IImageProvider GetCurrentProvider()
        {
            var settings = _settingsService.LoadSettings();
            var providerName = settings.Provider ?? "mock";

            if (_providers.TryGetValue(providerName, out var provider))
            {
                return provider;
            }

            // 默认返回 Mock
            return _providers["mock"];
        }

        /// <summary>
        /// 获取所有可用的 Provider 名称
        /// </summary>
        public IEnumerable<string> GetAvailableProviders()
        {
            return _providers.Keys;
        }

        /// <summary>
        /// 获取指定 Provider
        /// </summary>
        public IImageProvider? GetProvider(string name)
        {
            return _providers.TryGetValue(name, out var provider) ? provider : null;
        }
    }
}
