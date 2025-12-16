using Rhino;

namespace AIRenderPanel.Services
{
    /// <summary>
    /// 命名视图服务
    /// </summary>
    public class NamedViewService
    {
        /// <summary>
        /// 获取当前文档的所有命名视图名称
        /// </summary>
        /// <returns>命名视图名称列表</returns>
        public List<string> GetNamedViewNames()
        {
            var doc = RhinoDoc.ActiveDoc;
            if (doc == null)
                return new List<string>();

            var names = new List<string>();
            var namedViews = doc.NamedViews;

            for (int i = 0; i < namedViews.Count; i++)
            {
                var viewInfo = namedViews[i];
                if (viewInfo != null && !string.IsNullOrEmpty(viewInfo.Name))
                {
                    names.Add(viewInfo.Name);
                }
            }

            return names;
        }

        /// <summary>
        /// 检查命名视图是否存在
        /// </summary>
        /// <param name="name">命名视图名称</param>
        /// <returns>是否存在</returns>
        public bool Exists(string name)
        {
            var doc = RhinoDoc.ActiveDoc;
            if (doc == null)
                return false;

            return doc.NamedViews.FindByName(name) >= 0;
        }
    }
}
