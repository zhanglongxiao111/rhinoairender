using System.Drawing;
using System.Drawing.Imaging;
using Rhino;
using Rhino.Display;

namespace AIRenderPanel.Services
{
    /// <summary>
    /// 视口截图服务
    /// </summary>
    public class ViewportCaptureService
    {
        /// <summary>
        /// 获取活动视口的实际尺寸
        /// </summary>
        public (int Width, int Height) GetActiveViewportSize()
        {
            var doc = RhinoDoc.ActiveDoc;
            if (doc == null)
                return (1920, 1080); // 默认尺寸

            var view = doc.Views.ActiveView;
            if (view == null)
                return (1920, 1080);

            var bounds = view.Bounds;
            return (bounds.Width, bounds.Height);
        }

        /// <summary>
        /// 根据比例和长边尺寸计算实际截图尺寸
        /// </summary>
        /// <param name="aspectRatio">比例字符串，如 "16:9", "4:3", "1:1", 或 "auto"</param>
        /// <param name="longEdge">长边尺寸</param>
        /// <returns>计算后的宽度和高度</returns>
        public (int Width, int Height) CalculateSize(string? aspectRatio, int longEdge)
        {
            // 如果是 auto 或空，使用视口实际比例
            if (string.IsNullOrEmpty(aspectRatio) || aspectRatio.Equals("auto", StringComparison.OrdinalIgnoreCase))
            {
                var (vpWidth, vpHeight) = GetActiveViewportSize();
                double vpRatio = (double)vpWidth / vpHeight;

                if (vpRatio >= 1) // 横向
                {
                    return (longEdge, (int)(longEdge / vpRatio));
                }
                else // 纵向
                {
                    return ((int)(longEdge * vpRatio), longEdge);
                }
            }

            // 解析比例字符串
            var parts = aspectRatio.Split(':');
            if (parts.Length != 2 || !int.TryParse(parts[0], out int w) || !int.TryParse(parts[1], out int h))
            {
                // 解析失败，使用 16:9
                return (longEdge, (int)(longEdge * 9.0 / 16.0));
            }

            double ratio = (double)w / h;

            if (ratio >= 1) // 横向比例 (如 16:9)
            {
                return (longEdge, (int)(longEdge / ratio));
            }
            else // 纵向比例 (如 9:16)
            {
                return ((int)(longEdge * ratio), longEdge);
            }
        }

        /// <summary>
        /// 捕获活动视口截图
        /// </summary>
        /// <param name="width">输出宽度</param>
        /// <param name="height">输出高度</param>
        /// <param name="transparentBg">是否透明背景</param>
        /// <returns>PNG 格式的图片字节数组</returns>
        public byte[] CaptureActiveViewport(int width, int height, bool transparentBg)
        {
            var doc = RhinoDoc.ActiveDoc;
            if (doc == null)
                throw new InvalidOperationException("没有打开的 Rhino 文档");

            var view = doc.Views.ActiveView;
            if (view == null)
                throw new InvalidOperationException("没有活动视口");

            return CaptureView(view, width, height, transparentBg);
        }

        /// <summary>
        /// 使用比例和长边尺寸捕获活动视口截图
        /// </summary>
        public byte[] CaptureActiveViewportWithAspect(string? aspectRatio, int longEdge, bool transparentBg)
        {
            var (width, height) = CalculateSize(aspectRatio, longEdge);
            RhinoApp.WriteLine($"[AI渲染] 截图尺寸: {width}x{height} (比例: {aspectRatio ?? "auto"}, 长边: {longEdge})");
            return CaptureActiveViewport(width, height, transparentBg);
        }

        /// <summary>
        /// 捕获指定命名视图的截图
        /// </summary>
        /// <param name="viewName">命名视图名称</param>
        /// <param name="width">输出宽度</param>
        /// <param name="height">输出高度</param>
        /// <param name="transparentBg">是否透明背景</param>
        /// <returns>PNG 格式的图片字节数组</returns>
        public byte[] CaptureNamedView(string viewName, int width, int height, bool transparentBg)
        {
            var doc = RhinoDoc.ActiveDoc;
            if (doc == null)
                throw new InvalidOperationException("没有打开的 Rhino 文档");

            var view = doc.Views.ActiveView;
            if (view == null)
                throw new InvalidOperationException("没有活动视口");

            // 查找命名视图
            var namedViewIndex = doc.NamedViews.FindByName(viewName);
            if (namedViewIndex < 0)
                throw new InvalidOperationException($"找不到命名视图: {viewName}");

            // 保存当前视图状态
            view.ActiveViewport.PushViewProjection();

            try
            {
                // 恢复到命名视图
                doc.NamedViews.Restore(namedViewIndex, view, true);
                view.Redraw();

                // 截图
                return CaptureView(view, width, height, transparentBg);
            }
            finally
            {
                // 恢复原视图
                view.ActiveViewport.PopViewProjection();
                view.Redraw();
            }
        }

        /// <summary>
        /// 使用比例和长边尺寸捕获命名视图截图
        /// </summary>
        public byte[] CaptureNamedViewWithAspect(string viewName, string? aspectRatio, int longEdge, bool transparentBg)
        {
            var (width, height) = CalculateSize(aspectRatio, longEdge);
            RhinoApp.WriteLine($"[AI渲染] 截图尺寸: {width}x{height} (比例: {aspectRatio ?? "auto"}, 长边: {longEdge})");
            return CaptureNamedView(viewName, width, height, transparentBg);
        }

        /// <summary>
        /// 捕获指定视图
        /// </summary>
        private byte[] CaptureView(RhinoView view, int width, int height, bool transparentBg)
        {
            var size = new Size(width, height);
            
            // 使用当前显示模式捕获
            // 参数：size, drawGrid, drawAxis, drawBackground
            using var bitmap = view.CaptureToBitmap(size, false, false, !transparentBg);
            
            if (bitmap == null)
                throw new InvalidOperationException("截图失败");

            // 转换为 PNG 字节数组
            using var ms = new MemoryStream();
            bitmap.Save(ms, ImageFormat.Png);
            return ms.ToArray();
        }
    }
}

