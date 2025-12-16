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
