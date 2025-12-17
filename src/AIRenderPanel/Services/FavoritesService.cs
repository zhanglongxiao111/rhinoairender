using Newtonsoft.Json;

namespace AIRenderPanel.Services
{
    /// <summary>
    /// 收藏夹服务 - 管理用户收藏的历史记录
    /// </summary>
    public class FavoritesService
    {
        private readonly string _favoritesPath;
        private HashSet<string> _favorites;

        public FavoritesService()
        {
            var appDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "AIRenderPanel"
            );
            if (!Directory.Exists(appDataDir))
            {
                Directory.CreateDirectory(appDataDir);
            }
            _favoritesPath = Path.Combine(appDataDir, "favorites.json");
            _favorites = LoadFavorites();
        }

        /// <summary>
        /// 加载收藏列表
        /// </summary>
        private HashSet<string> LoadFavorites()
        {
            try
            {
                if (File.Exists(_favoritesPath))
                {
                    var json = File.ReadAllText(_favoritesPath);
                    var list = JsonConvert.DeserializeObject<List<string>>(json);
                    return list != null ? new HashSet<string>(list) : new HashSet<string>();
                }
            }
            catch
            {
                // 读取失败则返回空集合
            }
            return new HashSet<string>();
        }

        /// <summary>
        /// 保存收藏列表
        /// </summary>
        private void SaveFavorites()
        {
            try
            {
                var json = JsonConvert.SerializeObject(_favorites.ToList(), Formatting.Indented);
                File.WriteAllText(_favoritesPath, json);
            }
            catch
            {
                // 保存失败忽略
            }
        }

        /// <summary>
        /// 检查是否已收藏
        /// </summary>
        public bool IsFavorite(string historyId)
        {
            return _favorites.Contains(historyId);
        }

        /// <summary>
        /// 添加收藏
        /// </summary>
        public void AddFavorite(string historyId)
        {
            if (_favorites.Add(historyId))
            {
                SaveFavorites();
            }
        }

        /// <summary>
        /// 移除收藏
        /// </summary>
        public void RemoveFavorite(string historyId)
        {
            if (_favorites.Remove(historyId))
            {
                SaveFavorites();
            }
        }

        /// <summary>
        /// 切换收藏状态
        /// </summary>
        public bool ToggleFavorite(string historyId)
        {
            if (_favorites.Contains(historyId))
            {
                _favorites.Remove(historyId);
                SaveFavorites();
                return false;
            }
            else
            {
                _favorites.Add(historyId);
                SaveFavorites();
                return true;
            }
        }

        /// <summary>
        /// 获取所有收藏的 ID
        /// </summary>
        public HashSet<string> GetFavoriteIds()
        {
            return new HashSet<string>(_favorites);
        }
    }
}
